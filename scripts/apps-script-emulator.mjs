// Local stand-in for the deployed Google Apps Script backend, for testing the phone
// build without Google. Runs the real apps-script/dist/Code.gs with in-memory Drive,
// Sheets, lock and properties services. Data is lost when it stops.
//
//   npm run build:apps-script
//   node scripts/apps-script-emulator.mjs          (listens on http://localhost:4174/exec)
//   STAFF_CODE=1234 node scripts/apps-script-emulator.mjs
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import vm from 'node:vm';

const port = Number(process.env.PORT || 4174);
const signed = (bytes) => Array.from(bytes, (b) => (b > 127 ? b - 256 : b));
const properties = new Map(process.env.STAFF_CODE ? [['STAFF_CODE', process.env.STAFF_CODE]] : []);
const files = new Map();
const folders = new Map();
const sheets = new Map();
const photos = new Map();

function makeFile(_name, content) {
  const id = randomUUID();
  const file = {
    content: typeof content === 'string' ? content : '',
    getId: () => id,
    getBlob: () => ({ getDataAsString: () => file.content }),
    setContent: (text) => void (file.content = text),
    setSharing: () => undefined,
    moveTo: () => undefined,
  };
  if (typeof content !== 'string') photos.set(id, Buffer.from(content.bytes));
  files.set(id, file);
  return file;
}
function makeFolder() {
  const id = randomUUID();
  const folder = {
    getId: () => id,
    getUrl: () => `http://localhost:${port}/folder/${id}`,
    createFolder: () => makeFolder(),
    createFile: (nameOrBlob, content) =>
      typeof nameOrBlob === 'string'
        ? makeFile(nameOrBlob, content)
        : makeFile(nameOrBlob.name, { bytes: nameOrBlob.bytes }),
  };
  folders.set(id, folder);
  return folder;
}
const lookup = (map) => (id) => {
  if (!map.has(id)) throw new Error('Not found');
  return map.get(id);
};
function makeSpreadsheet() {
  const id = randomUUID();
  const tabs = new Map();
  const makeTab = (name) => {
    const tab = {
      clearContents: () => undefined,
      setRightToLeft: () => undefined,
      setFrozenRows: () => undefined,
      getRange: () => ({ setValues: () => undefined }),
    };
    tabs.set(name, tab);
    return tab;
  };
  const spreadsheet = {
    getId: () => id,
    getUrl: () => `http://localhost:${port}/sheet/${id}`,
    getSheetByName: (name) => tabs.get(name) ?? null,
    insertSheet: makeTab,
    getSheets: () => [...tabs.values()],
    deleteSheet: () => undefined,
  };
  sheets.set(id, spreadsheet);
  files.set(id, { moveTo: () => undefined });
  return spreadsheet;
}

const context = vm.createContext({
  Utilities: {
    getUuid: () => randomUUID(),
    base64Decode: (text) => signed(Buffer.from(text, 'base64')),
    newBlob: (bytes, type, name) => ({ bytes, type, name }),
    DigestAlgorithm: { SHA_256: 'sha256' },
    computeDigest: (_, text) => signed(createHash('sha256').update(text).digest()),
  },
  DriveApp: {
    Access: { ANYONE_WITH_LINK: 'anyone' },
    Permission: { VIEW: 'view' },
    createFolder: makeFolder,
    getFolderById: lookup(folders),
    getFileById: lookup(files),
  },
  SpreadsheetApp: { create: makeSpreadsheet, openById: lookup(sheets) },
  LockService: {
    getScriptLock: () => ({ tryLock: () => true, releaseLock: () => undefined }),
  },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: (key) => properties.get(key) ?? null,
      setProperty: (key, value) => void properties.set(key, value),
    }),
  },
  ContentService: {
    MimeType: { JSON: 'json' },
    createTextOutput: (content) => ({
      content,
      setMimeType() {
        return this;
      },
    }),
  },
  console,
});
vm.runInContext(
  readFileSync(new URL('../apps-script/dist/Code.gs', import.meta.url), 'utf8'),
  context,
);
context.setup();

http
  .createServer((req, res) => {
    // Photos: stand in for drive.google.com/thumbnail?id=...
    const url = new URL(req.url, `http://localhost:${port}`);
    // Stand-in for Project Settings > Script properties: /__property?STAFF_CODE=1234
    if (url.pathname === '/__property') {
      for (const [key, value] of url.searchParams) properties.set(key, value);
      res.writeHead(204);
      return res.end();
    }
    const photo = url.searchParams.get('id') && photos.get(url.searchParams.get('id'));
    if (photo) {
      res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Access-Control-Allow-Origin': '*' });
      return res.end(photo);
    }
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const output =
        req.method === 'POST' ? context.doPost({ postData: { contents: body } }) : context.doGet();
      const text = output.content.replaceAll(
        'https://drive.google.com/thumbnail?id=',
        `http://localhost:${port}/photo?id=`,
      );
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(text);
    });
  })
  .listen(port, () => console.log(`Balaa Apps Script emulator on http://localhost:${port}/exec`));
