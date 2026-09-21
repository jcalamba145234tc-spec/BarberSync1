import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { FinancialReport } from '../types/report';
import { Transaction } from '../types/transaction';
import { formatCurrency } from './calculations';
import { formatDate, formatDateTime } from './dateUtils';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildReportHtml(
  report: FinancialReport,
  transactions: Transaction[],
  shopName: string
): string {
  const summaryRows: Array<[string, string]> = [
    ['Gross Revenue', formatCurrency(report.grossRevenue)],
    ['Shop Share', formatCurrency(report.shopShare)],
    ['Barber Share (payout)', formatCurrency(report.barberShare)],
    ['Cash Revenue', formatCurrency(report.cashRevenue)],
    ['GCash Revenue', formatCurrency(report.gcashRevenue)],
    ['Transactions', String(report.transactionCount)],
    ['Expenses', formatCurrency(report.expenses)],
    ['Net Income', formatCurrency(report.netIncome)],
  ];

  const barberRows = report.barbers
    .map(
      (b) => `<tr>
        <td>${escapeHtml(b.barberName)}</td>
        <td class="num">${b.serviceCount}</td>
        <td class="num">${formatCurrency(b.revenue)}</td>
        <td class="num">${formatCurrency(b.earnings)}</td>
      </tr>`
    )
    .join('');

  const transactionRows = transactions
    .slice(0, 200)
    .map(
      (t) => `<tr>
        <td>${escapeHtml(formatDateTime(t.createdAt))}</td>
        <td>${escapeHtml(t.customerName)}</td>
        <td>${escapeHtml(t.barberName)}</td>
        <td>${escapeHtml(t.serviceName)}</td>
        <td class="num">${formatCurrency(t.amount)}</td>
        <td>${t.paymentMethod}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #111827; padding: 24px; }
  h1 { margin: 0; font-size: 26px; letter-spacing: 1px; }
  h2 { font-size: 15px; margin-top: 28px; text-transform: uppercase; letter-spacing: 1px; color: #6B7280; }
  .sub { color: #6B7280; margin-top: 4px; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
  th, td { border-bottom: 1px solid #E5E7EB; padding: 7px 6px; text-align: left; }
  th { background: #F5F6F8; text-transform: uppercase; font-size: 10px; letter-spacing: .6px; color: #6B7280; }
  .num { text-align: right; }
  .net { font-weight: 700; }
  .accent { color: #D4A537; }
</style></head>
<body>
  <h1>BarberSync <span class="accent">Financial Report</span></h1>
  <div class="sub">${escapeHtml(shopName)}</div>
  <div class="sub">Period: ${escapeHtml(report.range.label)} (${formatDate(report.range.from)} – ${formatDate(report.range.to)})</div>
  <div class="sub">Generated: ${formatDateTime(new Date())}</div>

  <h2>Summary</h2>
  <table>
    ${summaryRows
      .map(
        ([label, value], index) =>
          `<tr class="${index === summaryRows.length - 1 ? 'net' : ''}"><td>${label}</td><td class="num">${value}</td></tr>`
      )
      .join('')}
  </table>

  <h2>Barber Performance</h2>
  <table>
    <tr><th>Barber</th><th class="num">Services</th><th class="num">Revenue</th><th class="num">Earnings</th></tr>
    ${barberRows || '<tr><td colspan="4">No barber activity in this period.</td></tr>'}
  </table>

  <h2>Transaction Summary</h2>
  <table>
    <tr><th>Date</th><th>Customer</th><th>Barber</th><th>Service</th><th class="num">Amount</th><th>Payment</th></tr>
    ${transactionRows || '<tr><td colspan="6">No transactions in this period.</td></tr>'}
  </table>
</body></html>`;
}

/** Generates the PDF and opens the native share sheet. Returns the file URI. */
export async function exportReportPdf(
  report: FinancialReport,
  transactions: Transaction[],
  shopName: string
): Promise<string> {
  const html = buildReportHtml(report, transactions, shopName);
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share report' });
  }
  return uri;
}
