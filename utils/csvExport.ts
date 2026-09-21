import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
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
      t.paymentMethod,
      t.gcashReference ?? '',
      t.status,
    ]
      .map(escapeCell)
      .join(',')
  );
  return [HEADERS.join(','), ...rows].join('\r\n');
}

interface ModernFileSystem {
  File?: new (
    directory: unknown,
    name: string
  ) => { uri: string; create: (options?: { overwrite?: boolean }) => void; write: (data: string) => void };
  Paths?: { cache: unknown };
}

/**
 * Writes a text file to the cache directory.
 * SDK 53 exposes the classic helpers (cacheDirectory + writeAsStringAsync).
 * SDK 54+ replaced them with the File/Paths API, which is also exported from
 * the same module, so both are handled from one static import. No dynamic
 * require() is used: an unresolvable path would crash Metro at runtime.
 */
export async function writeTextFile(fileName: string, contents: string): Promise<string> {
  const classic = FileSystem as unknown as {
    cacheDirectory?: string | null;
    writeAsStringAsync?: (uri: string, data: string, options?: object) => Promise<void>;
  };

  if (classic.cacheDirectory && typeof classic.writeAsStringAsync === 'function') {
    const uri = `${classic.cacheDirectory}${fileName}`;
    await classic.writeAsStringAsync(uri, contents, { encoding: 'utf8' });
    return uri;
  }

  const modern = FileSystem as unknown as ModernFileSystem;
  if (modern.File && modern.Paths) {
    const file = new modern.File(modern.Paths.cache, fileName);
    file.create({ overwrite: true });
    file.write(contents);
    return file.uri;
  }

  throw new Error('No supported expo-file-system API was found on this device.');
}

/** Writes the CSV to the device and opens the share sheet. Returns the file URI. */
export async function exportTransactionsCsv(transactions: Transaction[]): Promise<string> {
  const csv = buildTransactionsCsv(transactions);
  const fileUri = await writeTextFile(`barbersync-transactions-${fileTimestamp()}.csv`, csv);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export transactions' });
  }
  return fileUri;
}

