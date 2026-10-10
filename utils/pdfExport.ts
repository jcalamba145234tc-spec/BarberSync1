/**
 * Renders a financial report as HTML and uses expo-print to turn it into a
 * PDF, then expo-sharing to let the admin save or send it.
 */
import * as Print from 'expo-print';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { Expense } from '../types/expense';
import { FinancialReport } from '../types/report';
import { PaymentMethod, Transaction } from '../types/transaction';
import { formatCurrency } from './calculations';
import { formatDate, formatDateTime } from './dateUtils';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface ReportPdfOptions {
  shopAddress?: string;
  shopContact?: string;
  expenses?: Expense[];
  monthlyFixedExpense?: number;
  paymentMethod?: PaymentMethod;
  barberName?: string;
  barberNames?: string[];
}

export function buildReportHtml(
  report: FinancialReport,
  transactions: Transaction[],
  shopName: string,
  options: ReportPdfOptions = {}
): string {
  const statusCounts = transactions.reduce(
    (counts, transaction) => {
      counts[transaction.status] += 1;
      return counts;
    },
    { COMPLETED: 0, PENDING_GCASH: 0, CANCELLED: 0 }
  );

  const transactionRows = transactions
    .map(
      (t) => `<tr>
        <td>${escapeHtml(formatDateTime(t.createdAt))}</td>
        <td>${escapeHtml(t.customerName)}</td>
        <td>${escapeHtml(t.barberName)}</td>
        <td>${escapeHtml(t.serviceName)}</td>
        <td>${t.paymentMethod === 'GCASH' ? 'GCash' : 'Cash'}</td>
        <td><span class="status status-${t.status.toLowerCase()}">${t.status === 'PENDING_GCASH' ? 'Pending GCash' : t.status.toLowerCase()}</span></td>
        <td class="num">${escapeHtml(formatCurrency(t.amount))}</td>
      </tr>`
    )
    .join('');

  const expenseRows = (options.expenses ?? [])
    .map(
      (expense) => `<tr>
        <td>${escapeHtml(formatDate(expense.date))}</td>
        <td>${escapeHtml(expense.name)}</td>
        <td>${escapeHtml(expense.category.replace(/_/g, ' '))}</td>
        <td class="num">${escapeHtml(formatCurrency(expense.amount))}</td>
      </tr>`
    )
    .join('');

  const activeFilters = [
    options.paymentMethod
      ? `Payment: ${options.paymentMethod === 'GCASH' ? 'GCash' : 'Cash'}`
      : null,
    options.barberName ? `Barber: ${options.barberName}` : null,
  ].filter((filter): filter is string => filter !== null);
  const expenseNote = activeFilters.length
    ? 'Shop-wide expenses are shown for reference and are not deducted from this filtered report.'
    : 'Net income is gross revenue less recorded expenses; barber payouts are shown separately.';
  const displayedTransactionCount = transactions.length;
  const generatedAt = formatDateTime(new Date());
  const filterMetadata = activeFilters.length ? activeFilters.map(escapeHtml).join(' · ') : 'None';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  @page { size: A4; margin: 16mm 15mm 17mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #202938; background: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; font-size: 9px; line-height: 1.5; }
  .report-header { padding: 0 0 13px; border-bottom: 2px solid #c7a45a; }
  .eyebrow { margin-bottom: 4px; color: #9a7837; font-size: 7px; font-weight: 750; letter-spacing: 1.6px; text-transform: uppercase; }
  h1 { margin: 0; color: #172235; font-size: 24px; font-weight: 750; letter-spacing: -.35px; line-height: 1.2; }
  .shop-name { margin-top: 4px; color: #404b5a; font-size: 11px; font-weight: 650; }
  .contact { margin-top: 2px; color: #647084; font-size: 8px; }
  .metadata { display: table; width: 100%; margin: 12px 0 16px; }
  .metadata-row { display: table-row; }
  .metadata-label, .metadata-value { display: table-cell; padding: 2px 0; vertical-align: top; }
  .metadata-label { width: 105px; color: #697587; font-weight: 650; }
  .metadata-value { color: #253044; }
  .section { margin-top: 18px; }
  .section-title { margin: 0 0 7px; padding-bottom: 5px; color: #172235; border-bottom: 1px solid #d9dee6; font-size: 11px; font-weight: 750; letter-spacing: .15px; page-break-after: avoid; break-after: avoid; }
  .section-note { margin: -2px 0 7px; color: #697587; font-size: 8px; }
  table { width: 100%; border-collapse: collapse; table-layout: auto; margin-top: 5px; font-size: 8.5px; }
  thead { display: table-header-group; }
  th, td { padding: 6px 7px; border-bottom: 1px solid #e3e7ed; text-align: left; vertical-align: top; }
  th { color: #596579; background: #f2f4f7; font-size: 7px; font-weight: 750; letter-spacing: .45px; text-transform: uppercase; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .summary-table td:first-child { width: 68%; }
  .summary-table .subtotal td { padding-top: 8px; border-top: 1px solid #cbd2dc; }
  .summary-table .expense-value { color: #8a3b32; }
  .summary-table .net-row td { padding-top: 8px; color: #172235; border-top: 1px solid #c7a45a; font-size: 9px; font-weight: 800; }
  .performance-table th:first-child { width: 45%; }
  .performance-table .earnings { color: #256747; }
  .expense-table th:nth-child(1) { width: 19%; }
  .expense-table th:nth-child(2) { width: 41%; }
  .expense-table th:nth-child(3) { width: 22%; }
  .expense-table th:nth-child(4) { width: 18%; }
  .ledger { table-layout: fixed; font-size: 8px; }
  .ledger th, .ledger td { padding: 5px 4px; overflow-wrap: anywhere; }
  .ledger th:nth-child(1) { width: 16%; }
  .ledger th:nth-child(2), .ledger th:nth-child(3) { width: 13%; }
  .ledger th:nth-child(4) { width: 16%; }
  .ledger th:nth-child(5) { width: 10%; }
  .ledger th:nth-child(6) { width: 13%; }
  .ledger th:nth-child(7) { width: 19%; }
  .status { font-size: 7px; font-weight: 700; text-transform: capitalize; }
  .status-completed { color: #256747; }
  .status-pending_gcash { color: #8a641e; }
  .status-cancelled { color: #8a3b32; }
  .empty { padding: 10px 7px; color: #697587; font-style: italic; }
  .totals td { border-top: 1px solid #cbd2dc; font-weight: 800; }
  .footnote { margin-top: 7px; color: #697587; font-size: 8px; }
  .report-footer { margin-top: 22px; padding-top: 6px; color: #7b8492; border-top: 1px solid #d9dee6; font-size: 7px; }
  .report-footer strong { color: #4d596a; }
  .transactions-section { page-break-before: always; break-before: page; }
  @media print { th { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style></head>
<body>
  <header class="report-header">
    <div class="eyebrow">Financial report</div>
    <h1>Sales Report</h1>
    <div class="shop-name">${escapeHtml(shopName)}</div>
    ${options.shopAddress ? `<div class="contact">${escapeHtml(options.shopAddress)}</div>` : ''}
    ${options.shopContact ? `<div class="contact">${escapeHtml(options.shopContact)}</div>` : ''}
  </header>

  <div class="metadata">
    <div class="metadata-row"><div class="metadata-label">Reporting period</div><div class="metadata-value">${escapeHtml(report.range.label)} · ${escapeHtml(formatDate(report.range.from))} – ${escapeHtml(formatDate(report.range.to))}</div></div>
    <div class="metadata-row"><div class="metadata-label">Generated</div><div class="metadata-value">${escapeHtml(generatedAt)}</div></div>
    <div class="metadata-row"><div class="metadata-label">Filters</div><div class="metadata-value">${filterMetadata}</div></div>
  </div>

  <section class="section">
    <h2 class="section-title">Financial summary</h2>
    <table class="summary-table">
      <tbody>
        <tr><td>Gross revenue</td><td class="num">${escapeHtml(formatCurrency(report.grossRevenue))}</td></tr>
        <tr><td>Shop share</td><td class="num">${escapeHtml(formatCurrency(report.shopShare))}</td></tr>
        <tr><td>Barber share (payout)</td><td class="num">${escapeHtml(formatCurrency(report.barberShare))}</td></tr>
        <tr><td>Tips (100% to barbers, not in revenue)</td><td class="num">${escapeHtml(formatCurrency(report.tips))}</td></tr>
        <tr class="subtotal"><td>Cash revenue</td><td class="num">${escapeHtml(formatCurrency(report.cashRevenue))}</td></tr>
        <tr><td>GCash revenue</td><td class="num">${escapeHtml(formatCurrency(report.gcashRevenue))}</td></tr>
        <tr><td>Completed transactions</td><td class="num">${report.transactionCount.toLocaleString('en-PH')}</td></tr>
        <tr class="subtotal"><td>Expenses</td><td class="num expense-value">${escapeHtml(formatCurrency(report.expenses))}</td></tr>
        <tr class="net-row"><td>Net income</td><td class="num">${escapeHtml(formatCurrency(report.netIncome))}</td></tr>
      </tbody>
    </table>
    <p class="section-note">${escapeHtml(expenseNote)}</p>
  </section>

  <section class="section">
    <h2 class="section-title">Barber performance</h2>
    <table class="performance-table">
      <thead><tr><th>Barber</th><th class="num">Customers served</th><th class="num">Revenue</th><th class="num">Earnings</th></tr></thead>
      <tbody>${report.barbers.length
        ? report.barbers.map((b) => `<tr><td>${escapeHtml(b.barberName)}</td><td class="num">${b.serviceCount.toLocaleString('en-PH')}</td><td class="num">${escapeHtml(formatCurrency(b.revenue))}</td><td class="num earnings">${escapeHtml(formatCurrency(b.earnings))}</td></tr>`).join('')
        : '<tr><td class="empty" colspan="4">No barber activity in this period.</td></tr>'}</tbody>
    </table>
  </section>

  <section class="section">
    <h2 class="section-title">Expenses</h2>
    ${options.monthlyFixedExpense !== undefined ? `<p class="section-note">Configured monthly fixed cost: ${escapeHtml(formatCurrency(options.monthlyFixedExpense))}.</p>` : ''}
    ${activeFilters.length ? '<p class="section-note">Shop-wide expenses are shown for reference and are excluded from this filtered report’s net income.</p>' : ''}
    ${(options.expenses ?? []).length === 0
      ? '<p class="empty">No expenses recorded in this period.</p>'
      : `<table class="expense-table"><thead><tr><th>Date</th><th>Expense</th><th>Category</th><th class="num">Amount</th></tr></thead><tbody>${expenseRows}</tbody>${activeFilters.length ? '' : `<tfoot><tr class="totals"><td colspan="3">Total recorded expenses</td><td class="num">${escapeHtml(formatCurrency(report.expenses))}</td></tr></tfoot>`}</table>`}
  </section>

  <section class="section transactions-section">
    <h2 class="section-title">Sales transactions</h2>
    <p class="section-note">Showing ${displayedTransactionCount.toLocaleString('en-PH')} transaction${displayedTransactionCount === 1 ? '' : 's'} · ${statusCounts.COMPLETED.toLocaleString('en-PH')} completed · ${statusCounts.PENDING_GCASH.toLocaleString('en-PH')} pending · ${statusCounts.CANCELLED.toLocaleString('en-PH')} cancelled. Only completed sales are included in revenue totals.</p>
    <table class="ledger">
      <thead><tr><th>Date</th><th>Customer</th><th>Barber</th><th>Service</th><th>Payment</th><th>Status</th><th class="num">Amount</th></tr></thead>
      <tbody>${transactionRows || '<tr><td class="empty" colspan="7">No transactions in this period.</td></tr>'}</tbody>
      ${transactions.length ? `<tfoot><tr class="totals"><td colspan="6">Completed sales total</td><td class="num">${escapeHtml(formatCurrency(report.grossRevenue))}</td></tr></tfoot>` : ''}
    </table>
  </section>
  <footer class="report-footer"><strong>${escapeHtml(shopName)}</strong>${options.shopAddress ? ` · ${escapeHtml(options.shopAddress)}` : ''}${options.shopContact ? ` · ${escapeHtml(options.shopContact)}` : ''} · Generated ${escapeHtml(generatedAt)}</footer>
</body></html>`;
}

function printReportInBrowser(html: string): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Could not open the PDF print window. Allow pop-ups for this site and try again.');
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

/**
 * Prints the report in a browser or generates and shares a native PDF.
 * Returns the native PDF URI when shared, or null when the print flow is used.
 */
export async function exportReportPdf(
  report: FinancialReport,
  transactions: Transaction[],
  shopName: string,
  options: ReportPdfOptions = {}
): Promise<string | null> {
  const html = buildReportHtml(report, transactions, shopName, options);
  if (Platform.OS === 'web') {
    printReportInBrowser(html);
    return null;
  }

  // expo-print may generate its PDF outside the current app's scoped cache
  // (notably in Expo Go). Sharing that URI directly can fail its read check.
  // Request the bytes and write a fresh PDF into expo-file-system's app cache;
  // no read/copy permission on the original Print URI is required.
  const result = await Print.printToFileAsync({ html, base64: true });
  if (!result.base64) {
    throw new Error('PDF generation returned no file data. Please try exporting again.');
  }

  const file = new File(Paths.cache,
    `barbersync-report-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.pdf`);
  file.create({ overwrite: true });
  // The string is encoded PDF data, not text. Decode it when writing to disk.
  file.write(result.base64, { encoding: 'base64' });
  if (!file.exists || file.size <= 0) {
    throw new Error('The PDF could not be saved to the app cache. Please try again.');
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: 'Share report',
    });
    // Keep the cache file: the receiving app may read it after the sheet closes.
    return file.uri;
  }

  await Print.printAsync({ uri: file.uri });
  return null;
}
