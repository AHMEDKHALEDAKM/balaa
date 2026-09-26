/* eslint-disable @typescript-eslint/no-explicit-any -- loose JSON shapes from the script and the fake Google services */
// Runs the generated Apps Script file (apps-script/dist/Code.gs) against in-memory
// stand-ins for Google's Drive, Sheets, lock and properties services.
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { beforeAll, describe, expect, it } from 'vitest';

type Result = { status: number; body: any; media?: Record<string, string> };
type Backend = {
  setup(): void;
  resetAllData(): void;
  handle(request: object): Result;
  doPost(e: object): { content: string };
};

const root = path.resolve(__dirname, '..');
const signed = (bytes: Uint8Array) => Array.from(bytes, (b) => (b > 127 ? b - 256 : b));

function fakeGoogle() {
  const properties = new Map<string, string>();
  const files = new Map<string, any>();
  const writes = { state: 0, sheet: 0 };
  const folders = new Map<string, any>();
  const sheets = new Map<string, any>();
  const makeFile = (name: string, content: string | { bytes: number[] }, mime = '') => {
    const id = randomUUID();
    const file = {
      name,
      mime,
      content: typeof content === 'string' ? content : '',
      bytes: typeof content === 'string' ? null : content.bytes,
      sharing: '',
      getId: () => id,
      getBlob: () => ({ getDataAsString: () => file.content }),
      setContent: (text: string) => {
        file.content = text;
        writes.state++;
      },
      setSharing: (access: string) => void (file.sharing = access),
      moveTo: () => undefined,
    };
    files.set(id, file);
    return file;
  };
  const makeFolder = (name: string): any => {
    const id = randomUUID();
    const folder = {
      name,
      getId: () => id,
      getUrl: () => `https://drive.test/${id}`,
      createFolder: (child: string) => makeFolder(child),
      createFile: (nameOrBlob: any, content?: string, mime?: string) =>
        typeof nameOrBlob === 'string'
          ? makeFile(nameOrBlob, content ?? '', mime)
          : makeFile(nameOrBlob.name, { bytes: nameOrBlob.bytes }, nameOrBlob.type),
    };
    folders.set(id, folder);
    return folder;
  };
  const lookup = (map: Map<string, any>) => (id: string) => {
    const item = map.get(id);
    if (!item) throw new Error('Not found');
    return item;
  };
  const makeSpreadsheet = () => {
    const id = randomUUID();
    const tabs = new Map<string, any>();
    const makeTab = (name: string) => {
      const tab = {
        values: [] as unknown[][],
        clearContents: () => void (tab.values = []),
        setRightToLeft: () => undefined,
        setFrozenRows: () => undefined,
        getRange: () => ({
          setValues: (v: unknown[][]) => {
            tab.values = v;
            writes.sheet++;
          },
        }),
      };
      tabs.set(name, tab);
      return tab;
    };
    makeTab('Sheet1');
    const spreadsheet = {
      tabs,
      getId: () => id,
      getUrl: () => `https://sheets.test/${id}`,
      getSheetByName: (name: string) => tabs.get(name) ?? null,
      insertSheet: makeTab,
      getSheets: () => [...tabs.values()],
      deleteSheet: (tab: any) => {
        for (const [key, value] of tabs) if (value === tab) tabs.delete(key);
      },
    };
    sheets.set(id, spreadsheet);
    files.set(id, { moveTo: () => undefined });
    return spreadsheet;
  };
  const google = {
    Utilities: {
      getUuid: () => randomUUID(),
      base64Decode: (text: string) => signed(Buffer.from(text, 'base64')),
      newBlob: (bytes: number[], type: string, name: string) => ({ bytes, type, name }),
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (_: string, text: string) =>
        signed(createHash('sha256').update(text).digest()),
    },
    DriveApp: {
      Access: { ANYONE_WITH_LINK: 'anyone_with_link' },
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
        getProperty: (key: string) => properties.get(key) ?? null,
        setProperty: (key: string, value: string) => void properties.set(key, value),
      }),
    },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (content: string) => ({
        content,
        setMimeType() {
          return this;
        },
      }),
    },
    console: { log: () => undefined, error: () => undefined },
  };
  return { google, properties, files, sheets, writes };
}

const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const now = () => new Date().toISOString();
const report = (imageUrl: string, latitude = 29.96, longitude = 31.26) => ({
  categoryId: 'pothole',
  severity: 'dangerous',
  description: 'حفرة أمام المدرسة',
  latitude,
  longitude,
  gpsAccuracy: 8,
  capturedLatitude: latitude,
  capturedLongitude: longitude,
  capturedAt: now(),
  deviceTimestamp: now(),
  imageUrl,
});

describe('Apps Script shared backend', () => {
  let backend: Backend;
  let fake: ReturnType<typeof fakeGoogle>;
  const call = (method: string, apiPath: string, body?: object, token?: string) =>
    backend.handle({ method, path: apiPath, body, token, device: 'test-device' });

  beforeAll(() => {
    execFileSync(process.execPath, [path.join(root, 'scripts/build-apps-script.mjs')]);
    fake = fakeGoogle();
    const context = vm.createContext({ ...fake.google });
    vm.runInContext(readFileSync(path.join(root, 'apps-script/dist/Code.gs'), 'utf8'), context);
    backend = context as unknown as Backend;
    backend.setup();
  }, 60000);

  it('starts empty and records a citizen report everyone can see', () => {
    expect(call('GET', '/api/public/reports').body.reports).toEqual([]);
    const login = call('POST', '/api/auth/mock', { name: 'منى', email: 'mona@example.com' });
    expect(login.status).toBe(200);
    expect(login.body.user).toMatchObject({ role: 'citizen', name: 'منى' });
    const token = login.body.token;
    expect(call('GET', '/api/auth/session', undefined, token).body.user.email).toBe(
      'mona@example.com',
    );

    const upload = call('POST', '/api/media', { dataUrl: png, kind: 'before' }, token);
    expect(upload.status).toBe(201);
    const mediaId = upload.body.imageUrl.split('/').pop();
    expect(upload.media?.[mediaId]).toMatch(/^https:\/\/drive\.google\.com\/thumbnail\?id=/);
    const photo = [...fake.files.values()].find((f) => f.name === `before-${mediaId}.jpg`);
    expect(photo?.sharing).toBe('anyone_with_link');

    const created = call('POST', '/api/reports', report(upload.body.imageUrl), token);
    expect(created.status).toBe(201);
    expect(created.body.report).toMatchObject({ publicId: 'BLAA-000001', status: 'delivered' });

    // A different phone, not signed in, sees the report, its photo and its history.
    const visitor = call('GET', '/api/public/reports');
    expect(visitor.body.reports).toHaveLength(1);
    expect(visitor.body.reports[0].history.map((h: any) => h.status)).toEqual([
      'submitted',
      'delivered',
    ]);
    expect(visitor.media?.[mediaId]).toBeTruthy();
    expect(JSON.stringify(visitor.body)).not.toContain('mona@example.com');
  });

  it('names the official Cairo district for any point and refuses places outside Cairo', () => {
    const writes = { ...fake.writes };
    const tahrir = call('POST', '/api/geo', { latitude: 30.0444, longitude: 31.2357 });
    expect(tahrir.body.district).toMatchObject({ id: 'qasr-el-nil', nameAr: 'قصر النيل' });
    const korba = call('POST', '/api/geo', { latitude: 30.0911, longitude: 31.3225 });
    expect(korba.body.district.nameAr).toBe('مصر الجديدة');
    const dokki = call('POST', '/api/geo', { latitude: 30.0385, longitude: 31.2123 });
    expect(dokki.status).toBe(422);
    expect(dokki.body.error).toBe('النسخة الحالية تغطي القاهرة فقط');
    // Lookups are answered without saving data or rebuilding the spreadsheet.
    expect(fake.writes).toEqual(writes);
    call('GET', '/api/public/reports');
    expect(fake.writes).toEqual(writes);
  });

  it('requires the team code for staff and runs the repair lifecycle', () => {
    expect(call('POST', '/api/auth/staff', { role: 'district_agent' }).body.error).toBe(
      'لم يتم ضبط رمز دخول فريق العمل بعد',
    );
    fake.properties.set('STAFF_CODE', 'maadi-2026');
    expect(call('POST', '/api/auth/staff', { role: 'district_agent', code: 'x' }).status).toBe(403);
    expect(
      call('POST', '/api/auth/staff', { role: 'district_agent', code: 'maadi-2026' }).body.error,
    ).toBe('اختر الحي');
    // Another district's team cannot see Maadi's report.
    const heliopolis = call('POST', '/api/auth/staff', {
      role: 'district_agent',
      code: 'maadi-2026',
      districtId: 'heliopolis',
    });
    expect(heliopolis.body.user).toMatchObject({
      districtIds: ['heliopolis'],
      name: 'مصر الجديدة',
    });
    expect(
      call('GET', '/api/dashboard/reports', undefined, heliopolis.body.token).body.reports,
    ).toEqual([]);
    const staff = call('POST', '/api/auth/staff', {
      role: 'district_agent',
      code: 'maadi-2026',
      districtId: 'maadi',
    });
    const token = staff.body.token;
    const [open] = call('GET', '/api/dashboard/reports', undefined, token).body.reports;
    for (const status of ['acknowledged', 'in_progress'])
      expect(
        call(
          'POST',
          `/api/dashboard/reports/${open.id}/status`,
          { status, note: 'تحديث من فريق الحي' },
          token,
        ).status,
      ).toBe(200);
    const fix = call('POST', '/api/media', { dataUrl: png, kind: 'resolution' }, token);
    const resolved = call(
      'POST',
      `/api/dashboard/reports/${open.id}/status`,
      { status: 'resolved', note: 'تم الردم والرصف', imageUrl: fix.body.imageUrl },
      token,
    );
    expect(resolved.body.report.status).toBe('resolved');
    const [publicReport] = call('GET', '/api/public/reports').body.reports;
    expect(publicReport.resolutionNote).toBe('تم الردم والرصف');
    expect(
      call('GET', '/api/public/reports').media?.[fix.body.imageUrl.split('/').pop()],
    ).toBeTruthy();
  });

  it('records every message that would be emailed without exposing citizen addresses', () => {
    const admin = call('POST', '/api/auth/staff', { role: 'platform_admin', code: 'maadi-2026' });
    const { notifications } = call('GET', '/api/admin/outbox', undefined, admin.body.token).body;
    const citizen = notifications.filter((n: any) => n.audience === 'citizen');
    const district = notifications.filter((n: any) => n.audience === 'district');
    expect(district).toHaveLength(2);
    expect(citizen.map((n: any) => n.subject)).toHaveLength(4);
    expect(citizen.every((n: any) => n.intendedTo === 'm***@example.com')).toBe(true);
    expect(notifications.every((n: any) => n.from?.includes('no-reply@'))).toBe(true);
    expect(JSON.stringify(notifications)).not.toContain('mona@example.com');

    const spreadsheet = [...fake.sheets.values()][0];
    expect(spreadsheet.tabs.get('البلاغات').values[1][0]).toBe('BLAA-000001');
    expect(spreadsheet.tabs.get('الرسائل (لم تُرسل)').values).toHaveLength(7);
    expect(spreadsheet.tabs.has('Sheet1')).toBe(false);
  });

  it('answers through doPost as JSON and can be reset to empty', () => {
    const output = backend.doPost({
      postData: { contents: JSON.stringify({ method: 'GET', path: '/api/config' }) },
    });
    expect(JSON.parse(output.content).body.mode).toBe('shared');
    backend.resetAllData();
    expect(call('GET', '/api/public/reports').body.reports).toEqual([]);
  });
});
