import { DEMO_ACCOUNTS, DEFAULT_SETTINGS, STORAGE_KEYS } from '../constants/config';
import { Expense } from '../types/expense';
import { QueueEntry } from '../types/queue';
import { BarberService } from '../types/service';
import { Transaction } from '../types/transaction';
import { calculateRevenueSplit } from '../utils/calculations';
import { startOfMonth } from '../utils/dateUtils';
import { replaceCachedExpenses } from './expenseService';
import { createLocalId, readJson, writeJson } from './localStore';
import { replaceCachedQueue } from './queueService';
import { DEFAULT_SERVICES, replaceCachedServices } from './serviceService';
import { replaceCachedTransactions } from './transactionService';

/**
 * Demo data lives only in the local AsyncStorage cache and is clearly marked
 * with the "DEMO" prefix in ids, so it never mixes with production Firestore data.
 */
function demoServices(): BarberService[] {
  return DEFAULT_SERVICES.map((service, index) => ({
    ...service,
    id: `DEMO_svc_${index + 1}`,
    createdAt: new Date().toISOString(),
  }));
}

const DEMO_BARBERS = DEMO_ACCOUNTS.barbers.map((barber, index) => ({
  id: `demo-barber-${index + 1}`,
  name: barber.name,
}));

function hoursAgo(hours: number): string {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date.toISOString();
}

function demoTransaction(
  serviceIndex: number,
  barberIndex: number,
  hours: number,
  paymentMethod: 'CASH' | 'GCASH',
  customerName: string,
  services: BarberService[]
): Transaction {
  const service = services[serviceIndex];
  const barber = DEMO_BARBERS[barberIndex];
  const { shopShare, barberShare } = calculateRevenueSplit(
    service.price,
    DEFAULT_SETTINGS.shopPercentage
  );
  const isGcash = paymentMethod === 'GCASH';
  return {
    id: `DEMO_txn_${serviceIndex}_${barberIndex}_${hours}`,
    customerName,
    barberId: barber.id,
    barberName: barber.name,
    serviceId: service.id,
    serviceName: service.name,
    amount: service.price,
    shopShare,
    barberShare,
    paymentMethod,
    gcashReference: isGcash ? `GC${1000000 + hours * 137}` : null,
    gcashScreenshotUrl: null,
    gcashVerified: false,
    status: isGcash ? 'PENDING_GCASH' : 'COMPLETED',
    createdAt: hoursAgo(hours),
    createdBy: barber.id,
    synced: true,
  };
}

function demoQueue(services: BarberService[]): QueueEntry[] {
  const entries: Array<[string, number, number]> = [
    ['John Santos', 0, 0],
    ['Mark Villanueva', 1, 1],
    ['Paolo Cruz', 3, 0],
  ];
  return entries.map(([customerName, serviceIndex, barberIndex], position) => ({
    id: `DEMO_que_${position + 1}`,
    customerName,
    serviceId: services[serviceIndex].id,
    serviceName: services[serviceIndex].name,
    barberId: DEMO_BARBERS[barberIndex].id,
    barberName: DEMO_BARBERS[barberIndex].name,
    status: position === 0 ? 'IN_SERVICE' : 'WAITING',
    arrivalTime: hoursAgo(1 - position * 0.2),
    estimatedWaitTime: 0,
    startedAt: position === 0 ? hoursAgo(0.2) : null,
    completedAt: null,
  }));
}

function demoExpenses(): Expense[] {
  const monthStart = startOfMonth().toISOString();
  return [
    {
      id: 'DEMO_exp_rent',
      name: 'Shop Rent',
      amount: 20000,
      category: 'RENT',
      date: monthStart,
      notes: 'Fixed monthly rent',
      createdAt: monthStart,
    },
    {
      id: 'DEMO_exp_utilities',
      name: 'Electricity & Water',
      amount: 4000,
      category: 'UTILITIES',
      date: monthStart,
      notes: 'Fixed monthly utilities',
      createdAt: monthStart,
    },
    {
      id: 'DEMO_exp_supplies',
      name: 'Clipper blades & pomade',
      amount: 1200,
      category: 'SUPPLIES',
      date: hoursAgo(72),
      notes: '',
      createdAt: hoursAgo(72),
    },
  ];
}

/** Seeds demo data once. Safe to call on every app start. */
export async function seedDemoData(force = false): Promise<void> {
  const alreadySeeded = await readJson<boolean>(STORAGE_KEYS.demoSeeded, false);
  if (alreadySeeded && !force) return;

  const services = demoServices();
  const transactions: Transaction[] = [
    demoTransaction(0, 0, 1, 'CASH', 'Ramon Dizon', services),
    demoTransaction(1, 0, 2, 'GCASH', 'Alvin Mercado', services),
    demoTransaction(0, 1, 3, 'CASH', 'Kenneth Yu', services),
    demoTransaction(2, 1, 4, 'CASH', 'Bryan Lim', services),
    demoTransaction(3, 0, 5, 'GCASH', 'Jayson Abad', services),
    demoTransaction(1, 1, 26, 'CASH', 'Carlo Ramos', services),
    demoTransaction(0, 0, 30, 'CASH', 'Dennis Uy', services),
    demoTransaction(3, 1, 50, 'GCASH', 'Miguel Torres', services),
  ];

  await replaceCachedServices(services);
  await replaceCachedTransactions(transactions);
  await replaceCachedQueue(demoQueue(services));
  await replaceCachedExpenses(demoExpenses());
  await writeJson(STORAGE_KEYS.demoSeeded, true);
}

/** Removes every demo record from the device. */
export async function clearDemoData(): Promise<void> {
  await replaceCachedServices([]);
  await replaceCachedTransactions([]);
  await replaceCachedQueue([]);
  await replaceCachedExpenses([]);
  await writeJson(STORAGE_KEYS.demoSeeded, false);
}

export function isDemoRecord(id: string): boolean {
  return id.startsWith('DEMO_');
}

export { createLocalId };
