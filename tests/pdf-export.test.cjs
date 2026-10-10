const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const report = {
  range: { from: '2026-10-01', to: '2026-10-31', label: 'October' },
  grossRevenue: 0, shopShare: 0, barberShare: 0, tips: 0,
  cashRevenue: 0, gcashRevenue: 0, transactionCount: 0, expenses: 0, netIncome: 0, barbers: [],
};
const pdfBytes = Buffer.from('%PDF-1.4\nmock-pdf\n%%EOF');
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../utils/pdfExport.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function fixture(options = {}) {
  const generated = [], files = [], shared = [], printed = [];
  const cache = 'file:///data/user/0/app/cache/';
  class File {
    constructor(directory, name) {
      assert.equal(directory, cache);
      this.uri = directory + name;
      this.exists = false;
      this.size = 0;
      files.push(this);
    }
    create(options) { assert.equal(options.overwrite, true); this.exists = true; }
    write(value, options) {
      assert.equal(options.encoding, 'base64');
      if (options.encoding !== 'base64') throw new Error('PDF written as plain text');
      this.bytes = Buffer.from(value, 'base64');
      this.size = this.bytes.length;
    }
  }
  if (options.failWrite) File.prototype.write = () => { throw new Error('disk full'); };
  if (options.emptyFile) File.prototype.write = () => {};
  const modules = {
    'expo-file-system': { File, Paths: { cache } },
    'react-native': { Platform: { OS: options.platform ?? 'android' } },
    'expo-print': {
      printToFileAsync: async (args) => {
        generated.push(args);
        if (options.generationError) throw new Error('printer failed');
        return { uri: 'file:///outside-app-cache/Print/original.pdf',
          base64: options.noBase64 ? undefined : pdfBytes.toString('base64') };
      },
      printAsync: async (args) => { printed.push(args); },
    },
    'expo-sharing': {
      isAvailableAsync: async () => options.available !== false,
      shareAsync: async (uri, args) => {
        // Reproduce the original rejection for any non-app-cache URI.
        if (!uri.startsWith(cache)) throw new Error('Not allowed to read file under given URL.');
        if (options.sharingError) throw new Error('native share failed');
        shared.push({ uri, args });
      },
    },
    './calculations': { formatCurrency: (value) => `PHP ${value}` },
    './dateUtils': { formatDate: (value) => String(value), formatDateTime: (value) => String(value) },
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((name) => {
    if (!(name in modules)) throw new Error(`Unexpected import: ${name}`);
    return modules[name];
  }, module, module.exports);
  return { ...module.exports, generated, files, shared, printed, cache };
}

test('native sharing writes decoded PDF bytes in scoped cache rather than sharing the rejected Print URI', async () => {
  const f = fixture();
  const uri = await f.exportReportPdf(report, [], 'Shop');
  assert.equal(f.generated[0].base64, true);
  assert.deepEqual(f.files[0].bytes, pdfBytes);
  assert.equal(f.files[0].exists, true);
  assert.equal(uri, f.files[0].uri);
  assert.equal(f.shared[0].uri, uri);
  assert.equal(f.shared[0].args.mimeType, 'application/pdf');
  assert.equal(f.shared[0].args.UTI, 'com.adobe.pdf');
  assert.equal(f.printed.length, 0);
});

test('iOS also uses the validated cache PDF and PDF UTI', async () => {
  const f = fixture({ platform: 'ios' });
  await f.exportReportPdf(report, [], 'Shop');
  assert.equal(f.shared.length, 1);
  assert.equal(f.shared[0].args.UTI, 'com.adobe.pdf');
});

test('no-sharing fallback prints the safe cache URI', async () => {
  const f = fixture({ available: false });
  assert.equal(await f.exportReportPdf(report, [], 'Shop'), null);
  assert.equal(f.shared.length, 0);
  assert.equal(f.printed[0].uri, f.files[0].uri);
});

test('missing PDF bytes or empty cache file does not open the share sheet', async () => {
  for (const options of [{ noBase64: true }, { emptyFile: true }]) {
    const f = fixture(options);
    await assert.rejects(f.exportReportPdf(report, [], 'Shop'), /no file data|could not be saved/);
    assert.equal(f.shared.length, 0);
    assert.equal(f.printed.length, 0);
  }
});

test('generation, write, and native-sharing failures propagate instead of falsely reporting success', async () => {
  for (const [options, message] of [[{ generationError: true }, /printer failed/], [{ failWrite: true }, /disk full/], [{ sharingError: true }, /native share failed/]]) {
    const f = fixture(options);
    await assert.rejects(f.exportReportPdf(report, [], 'Shop'), message);
    assert.equal(f.printed.length, 0);
  }
});

test('concurrent exports use different filenames and retain files for receiving apps', async () => {
  const f = fixture();
  const [a, b] = await Promise.all([f.exportReportPdf(report, [], 'Shop'), f.exportReportPdf(report, [], 'Shop')]);
  assert.notEqual(a, b);
  assert.ok(f.files.every((file) => file.exists));
});

test('browser path remains unchanged and never uses native generation or sharing', async () => {
  const f = fixture({ platform: 'web' });
  const previous = global.window;
  let printed = false;
  global.window = { open: () => ({ document: { open() {}, write() {}, close() {} }, focus() {}, print() { printed = true; } }) };
  try {
    assert.equal(await f.exportReportPdf(report, [], 'Shop'), null);
    assert.equal(printed, true);
    assert.equal(f.generated.length, 0);
    assert.equal(f.shared.length, 0);
  } finally { global.window = previous; }
});
