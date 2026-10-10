const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

// Load production TypeScript with narrow native/backend doubles; no Firebase credentials needed.
function fixture(extras = {}) {
  const modules = new Map();
  const store = new Map();
  const listeners = [];
  const reads = [];
  let remote = [];
  const firebase = {
    collection: (_db, name) => ({ collection: name }),
    doc: (_db, collection, id) => ({ collection, id }),
    where: (field, op, value) => ({ kind: 'where', field, op, value }),
    orderBy: (field, direction) => ({ kind: 'order', field, direction }),
    limit: (value) => ({ kind: 'limit', value }),
    query: (ref, ...constraints) => ({ ...ref, constraints }),
    onSnapshot: (ref, options, next, error) => {
      const listener = { ref, options, next, error, stopped: false };
      listeners.push(listener);
      return () => { listener.stopped = true; };
    },
    getDocs: async (ref) => {
      reads.push(ref);
      let rows = remote.filter((row) => (ref.constraints ?? []).every((c) => c.kind !== 'where' ||
        (c.op === '==' ? row[c.field] === c.value : c.op === '>=' ? row[c.field] >= c.value : row[c.field] <= c.value)));
      const cap = ref.constraints?.find((c) => c.kind === 'limit');
      if (cap) rows = rows.slice(0, cap.value);
      return { docs: rows.map((row) => ({ id: row.id, data: () => row })), empty: !rows.length };
    },
  };
  const mocks = {
    'firebase/firestore': firebase,
    [path.join(root, 'services/firebase.ts')]: { firestore: {} },
    [path.join(root, 'services/localStore.ts')]: {
      readJson: async (key, fallback) => store.has(key) ? structuredClone(store.get(key)) : fallback,
      writeJson: async (key, value) => { store.set(key, structuredClone(value)); },
      createLocalId: () => 'local-test',
    },
    [path.join(root, 'services/networkService.ts')]: { isOnline: async () => true },
    [path.join(root, 'services/pendingOps.ts')]: { enqueueOp: async () => {} },
    ...extras,
  };
  function load(name, from = path.join(root, 'test-entry.cjs')) {
    let resolved = name;
    if (name.startsWith('.')) {
      resolved = path.resolve(path.dirname(from), name);
      if (!path.extname(resolved)) resolved += '.ts';
    }
    if (resolved in mocks) return mocks[resolved];
    if (!path.isAbsolute(resolved)) return require(resolved);
    if (modules.has(resolved)) return modules.get(resolved).exports;
    const module = { exports: {} };
    modules.set(resolved, module);
    const code = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText;
    new Function('require', 'module', 'exports', code)((name) => load(name, resolved), module, module.exports);
    return module.exports;
  }
  return { load, store, listeners, reads, setRemote: (rows) => { remote = rows; },
    snapshot: (listener, rows, fromCache = false) => listener.next({ metadata: { fromCache }, docs: rows.map((row) => ({ id: row.id, data: () => row })) }) };
}
const range = { from: '2026-10-01T00:00:00.000Z', to: '2026-10-31T23:59:59.999Z' };
const admin = { id: 'admin', role: 'ADMIN' };
function sale(id, overrides = {}) {
  return { id, createdAt: '2026-10-10T10:00:00.000Z', barberId: 'b1', barberName: 'One', serviceId: 'cut',
    customerName: 'Customer', serviceName: 'Cut', amount: 100, shopShare: 50, barberShare: 50,
    paymentMethod: 'CASH', status: 'COMPLETED', gcashVerified: false, synced: true, ...overrides };
}

test('barber queries force own UID, apply server-side range, and do not cap rows', () => {
  const f = fixture(); const tx = f.load('./services/transactionService');
  const constraints = tx.transactionConstraints({ id: 'b1', role: 'BARBER' }, { ...range, barberId: 'b2' });
  assert.equal(constraints.find((c) => c.field === 'barberId').value, 'b1');
  assert.equal(constraints.filter((c) => c.field === 'createdAt' && c.kind === 'where').length, 2);
  assert.equal(constraints.some((c) => c.kind === 'limit'), false);
});

test('selected historical reports return more than 500 rows, not the newest global 500', async () => {
  const f = fixture(); const tx = f.load('./services/transactionService'); const config = f.load('./constants/config');
  f.store.set(config.STORAGE_KEYS.cachedUser, admin);
  f.setRemote([...Array.from({ length: 650 }, (_, i) => sale(`oct-${i}`)), sale('nov', { createdAt: '2026-11-01T00:00:00.000Z' })]);
  const rows = await tx.getTransactions(range);
  assert.equal(rows.length, 650);
  assert.equal(f.store.get(config.STORAGE_KEYS.cachedTransactions).length, 650);
  assert.equal(f.reads[0].constraints.some((c) => c.kind === 'limit'), false);
});

test('same-range listeners share backend reads and fan out payment filters, updates, deletions', async () => {
  const f = fixture(); const tx = f.load('./services/transactionService'); const cash = [], gcash = [];
  const stop1 = tx.subscribeTransactions(admin, { ...range, paymentMethod: 'CASH' }, (rows) => cash.push(rows), assert.fail);
  const stop2 = tx.subscribeTransactions(admin, { ...range, paymentMethod: 'GCASH' }, (rows) => gcash.push(rows), assert.fail);
  assert.equal(f.listeners.length, 1);
  f.snapshot(f.listeners[0], [sale('cash'), sale('gcash', { paymentMethod: 'GCASH' })]); await tick();
  assert.deepEqual(cash.at(-1).map((r) => r.id), ['cash']);
  assert.deepEqual(gcash.at(-1).map((r) => r.id), ['gcash']);
  f.snapshot(f.listeners[0], [sale('cash', { status: 'CANCELLED' })]); await tick();
  assert.equal(cash.at(-1)[0].status, 'CANCELLED'); assert.equal(gcash.at(-1).length, 0);
  stop1(); assert.equal(f.listeners[0].stopped, false);
  stop2(); assert.equal(f.listeners[0].stopped, true);
});

test('cache-only empty snapshots do not erase data; confirmed empty server snapshots do', async () => {
  const f = fixture(); const tx = f.load('./services/transactionService'); const seen = [];
  const stop = tx.subscribeTransactions(admin, range, (rows) => seen.push(rows), assert.fail);
  f.snapshot(f.listeners[0], [sale('a')]); await tick();
  f.snapshot(f.listeners[0], [], true); assert.equal(seen.at(-1).length, 1);
  f.snapshot(f.listeners[0], []); await tick(); assert.equal(seen.at(-1).length, 0);
  stop();
});

test('pending offline sales survive live snapshots without duplicate IDs or out-of-range rows', async () => {
  const f = fixture(); const tx = f.load('./services/transactionService'); const config = f.load('./constants/config');
  f.store.set(config.STORAGE_KEYS.pendingTransactions, [sale('pending'), sale('remote'), sale('old', { createdAt: '2025-01-01T00:00:00.000Z' })]);
  let latest;
  const stop = tx.subscribeTransactions(admin, range, (rows) => { latest = rows; }, assert.fail);
  f.snapshot(f.listeners[0], [sale('remote')]); await tick();
  assert.deepEqual(latest.map((r) => r.id).sort(), ['pending', 'remote']);
  stop();
});

test('auth keys isolate listeners and detach each account cleanly', () => {
  const f = fixture(); const tx = f.load('./services/transactionService');
  const a = tx.subscribeTransactions(admin, range, () => {}, assert.fail);
  const b = tx.subscribeTransactions({ id: 'b1', role: 'BARBER' }, range, () => {}, assert.fail);
  assert.equal(f.listeners.length, 2); a(); b();
  assert.ok(f.listeners.every((l) => l.stopped));
});

test('report recalculation responds to sales, cancellation, expenses and fixed-cost settings', () => {
  const f = fixture(); const { buildReportResult } = f.load('./services/reportService');
  const { DEFAULT_SETTINGS } = f.load('./constants/config');
  const filters = { from: '2026-10-01T00:00:00.000Z', to: '2026-10-31T23:59:59.999Z', label: 'October' };
  const settings = { ...DEFAULT_SETTINGS, monthlyFixedExpense: 0 };
  const ex = [{ id: 'ex', amount: 10, category: 'SUPPLIES', date: '2026-10-10T00:00:00.000Z' }];
  assert.equal(buildReportResult(filters, settings, [sale('a')], ex).report.netIncome, 90);
  assert.equal(buildReportResult(filters, settings, [sale('a'), sale('b')], ex).report.grossRevenue, 200);
  assert.equal(buildReportResult(filters, settings, [sale('a', { status: 'CANCELLED' })], ex).report.grossRevenue, 0);
  assert.equal(buildReportResult(filters, { ...settings, monthlyFixedExpense: 20 }, [sale('a')], ex).report.netIncome, 70);
  assert.equal(buildReportResult({ ...filters, barberId: 'b1' }, settings, [sale('a')], ex).report.expenses, 0);
});

test('attendance reconciles active additions and missing documents without generating saved records', () => {
  const f = fixture(); const { reconcileAttendance } = f.load('./services/attendanceService');
  const barbers = [{ id: 'b1', name: 'One' }, { id: 'b2', name: 'Two' }, { id: 'off', active: false }];
  const day = reconcileAttendance('2026-10-10', barbers, null);
  assert.equal(day.draft, true); assert.equal(day.records.length, 2);
  const saved = reconcileAttendance('2026-10-10', barbers, { ...day, draft: false, records: [{ barberId: 'b1', status: 'ABSENT' }] });
  assert.equal(saved.records[0].status, 'ABSENT'); assert.equal(saved.records[1].status, 'PRESENT');
});

test('expense and attendance listeners use scoped queries and handle remote deletion', async () => {
  const f = fixture(); const live = f.load('./services/liveData'); let expenses, attendance;
  const stopExpense = live.subscribeExpenses('admin', range.from, range.to, (rows) => { expenses = rows; }, assert.fail);
  assert.equal(f.listeners[0].ref.constraints.length, 2);
  f.snapshot(f.listeners[0], [{ id: 'ex', date: '2026-10-10T00:00:00.000Z', amount: 5 }]); assert.equal(expenses.length, 1);
  const stopAttendance = live.subscribeAttendance('admin', '2026-10-10', [{ id: 'b1', name: 'One' }], (day) => { attendance = day; }, assert.fail);
  f.listeners[1].next({ metadata: { fromCache: false }, exists: () => false });
  assert.equal(attendance.draft, true); await tick(); stopExpense(); stopAttendance();
});

test('shared data listens to services/settings for both roles and staff only for admin', () => {
  const f = fixture(); const live = f.load('./services/liveData');
  const callbacks = { services: () => {}, settings: () => {}, barbers: () => {}, error: assert.fail };
  const stopBarber = live.subscribeSharedData({ id: 'b1', role: 'BARBER' }, callbacks);
  assert.equal(f.listeners.length, 2); stopBarber();
  const stopAdmin = live.subscribeSharedData(admin, callbacks); assert.equal(f.listeners.length, 5);
  stopAdmin(); assert.ok(f.listeners.every((l) => l.stopped));
});

// Minimal hook harness exercises the production effect guards and cleanup, not a copy of the hook.
function hookHarness() {
  const slots = []; let cursor = 0, focus, cleanup, lastFocus;
  const same = (a, b) => a && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], (next) => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ?? (slots[i] = { current: initial }); },
    useCallback(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { fn, deps }; return slots[i].fn; },
  };
  const f = fixture({ react, 'expo-router': { useFocusEffect: (fn) => { focus = fn; } } });
  const { useRealtimeResource } = f.load('./hooks/useRealtimeResource');
  return {
    render(load, subscribe) {
      cursor = 0; const value = useRealtimeResource([], load, subscribe);
      if (focus !== lastFocus) { cleanup?.(); lastFocus = focus; cleanup = focus(); }
      return value;
    },
    blur() { cleanup?.(); },
  };
}

test('hook discards slow initial/manual reads after live data, and cleans up on blur', async () => {
  const h = hookHarness(); const first = deferred(), manual = deferred(); let next, stopped = false;
  const load = (cacheOnly) => cacheOnly ? first.promise : manual.promise;
  const subscribe = (callback) => { next = callback; return () => { stopped = true; }; };
  let state = h.render(load, subscribe);
  next(['live']); first.resolve(['stale-cache']); await tick();
  state = h.render(load, subscribe); assert.deepEqual(state.data, ['live']);
  const refresh = state.refresh(); next(['newer-live']); manual.resolve(['old-refresh']); await refresh;
  state = h.render(load, subscribe); assert.deepEqual(state.data, ['newer-live']);
  h.blur(); assert.equal(stopped, true); next(['after-blur']);
  state = h.render(load, subscribe); assert.deepEqual(state.data, ['newer-live']);
});

test('range changes ignore late callbacks from the previous listener and show errors', async () => {
  const h = hookHarness(); const old = deferred(); let oldNext, newNext, fail;
  const oldLoad = () => old.promise;
  const oldSubscribe = (next) => { oldNext = next; return () => {}; };
  h.render(oldLoad, oldSubscribe);
  const newLoad = async () => ['new-cache'];
  const newSubscribe = (next, error) => { newNext = next; fail = error; return () => {}; };
  h.render(newLoad, newSubscribe); newNext(['new-live']); oldNext(['old-live']); old.resolve(['old-cache']); await tick();
  let state = h.render(newLoad, newSubscribe); assert.deepEqual(state.data, ['new-live']);
  const originalWarn = console.warn; console.warn = () => {};
  try { fail(new Error('permission-denied')); } finally { console.warn = originalWarn; }
  state = h.render(newLoad, newSubscribe); assert.match(state.error, /Live updates unavailable/); assert.equal(state.loading, false);
  h.blur();
});
