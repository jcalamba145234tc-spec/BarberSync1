import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { Transaction } from '../types/transaction';
import { fileTimestamp, formatDateTime } from './dateUtils';

const HEADERS = [
  'Date',
  'Customer',
  'Barber',
  'Service',
  'Amount',
  'Shop Share',
  'Barber Share',
  'Tip',
  'Payment Method',
  'GCash Reference',
  'Status',
];

/** Escapes a value so commas, quotes and newlines never break the CSV. */
function escapeCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildTransactionsCsv(transactions: Transaction[]): string {
  const rows = transactions.map((t) =>
    [
      formatDateTime(t.createdAt),
      t.customerName,
      t.barberName,
      t.serviceName,
      t.amount.toFixed(2),
      t.shopShare.toFixed(2),
      t.barberShare.toFixed(2),
      (t.tip ?? 0).toFixed(2),
      t.paymentMethod,
      t.gcashReference ?? '',
      t.status,
    ]
      .map(escapeCell)
      .join(',')
  );
  return [HEADERS.join(','), ...rows].join('\r\n');
}

/** Writes a text file to the native app cache using Expo's current File API. */
export async function writeTextFile(fileName: string, contents: string): Promise<string> {
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(contents);
  return file.uri;
}

function downloadCsvInBrowser(fileName: string, contents: string): void {
  if (
    typeof document === 'undefined' ||
    typeof window === 'undefined' ||
    typeof Blob === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    throw new Error('CSV download is not supported in this browser.');
  }

  const blob = new Blob([contents], { type: 'text/csv;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}

/** Exports the CSV in the browser or opens the native share sheet. */
export async function exportTransactionsCsv(transactions: Transaction[]): Promise<string> {
  const csv = buildTransactionsCsv(transactions);
  const fileName = `barbersync-transactions-${fileTimestamp()}.csv`;
  if (Platform.OS === 'web') {
    downloadCsvInBrowser(fileName, csv);
    return fileName;
  }

  const fileUri = await writeTextFile(fileName, csv);
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('File sharing is unavailable on this device, so the CSV could not be opened.');
  }
  await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export transactions' });
  return fileUri;
}
