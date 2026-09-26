/* global BalaaCore, SyncPromise, ContentService, DriveApp, LockService, PropertiesService, SpreadsheetApp, Utilities */
// Balaa shared backend for the phone app on GitHub Pages.
// Runs the same demo rules as the Next.js server (BalaaCore, bundled above) and keeps:
//   - all reports and history in "balaa-state.json" in the Balaa Drive folder,
//   - photos as separate files in that folder (viewable by link, so the app can show them),
//   - a readable copy in the "Balaa · Reports" spreadsheet, rebuilt after every change.
// Nothing is emailed. Messages that would be sent are listed in the spreadsheet's outbox tab.

var SESSION_DAYS = 30;

/** Run once from the editor (Run > setup). Creates the Drive folder, data file and spreadsheet. */
function setup() {
  var store = openStore();
  var state = store.load();
  store.save(state);
  mirror(state, store);
  var code = PropertiesService.getScriptProperties().getProperty('STAFF_CODE');
  console.log('Balaa folder: ' + store.folder.getUrl());
  console.log('Spreadsheet: ' + store.sheet().getUrl());
  console.log(
    code
      ? 'Staff code is set.'
      : 'Next: Project Settings > Script properties > add STAFF_CODE (the district team access code).',
  );
}

/** Deletes every report, photo record, session and message, starting the platform empty again. */
function resetAllData() {
  var store = openStore();
  var state = BalaaCore.seed(false);
  store.save(state);
  mirror(state, store);
  console.log('All Balaa data was reset. Photo files remain in the Drive folder "photos".');
}

function doGet() {
  return respond({ status: 200, body: { service: 'balaa', ok: true } });
}

function doPost(e) {
  var request;
  try {
    request = JSON.parse(e.postData.contents);
  } catch (error) {
    return respond({ status: 400, body: { error: 'Invalid JSON' } });
  }
  return respond(handle(request));
}

function respond(result) {
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

/** request: { method, path, body, token, device } */
function handle(request) {
  var method = request.method === 'POST' ? 'POST' : 'GET';
  var path = String(request.path || '')
    .split('?')[0]
    .replace(/^\/?api\//, '')
    .split('/')
    .filter(Boolean)
    .map(decodeURIComponent);
  var endpoint = path.join('/');
  if (endpoint === 'config')
    return { status: 200, body: { mode: 'shared', identityMock: true, staffCodeRequired: true } };
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var store = openStore();
    var state = store.load();
    var user = sessionUser(state, request.token);
    if (endpoint === 'auth/logout') {
      if (request.token) {
        var hash = hashToken(request.token);
        state.sessions = state.sessions.filter(function (s) {
          return s.hash !== hash;
        });
        store.save(state);
      }
      return { status: 200, body: { ok: true } };
    }
    var result = SyncPromise.unwrap(
      BalaaCore.demoRequest(state, user, method, path, request.body || {}, {
        clientKey: String(request.device || 'unknown').slice(0, 80),
        // The app already resized the photo and re-encoded it as JPEG before sending.
        normalizeImage: function (base64) {
          return base64;
        },
        staffCode: PropertiesService.getScriptProperties().getProperty('STAFF_CODE') || '',
        triageUnmapped: true,
      }),
    );
    if (result.login) {
      var token = issueSession(state, result.login);
      result = { status: 200, body: { user: result.login, token: token } };
    }
    var changed = method === 'POST' || !!result.login;
    if (changed) {
      storePhotos(state, store);
      store.save(state);
      mirror(state, store);
    }
    return { status: result.status, body: result.body, media: mediaUrls(state, result.body) };
  } catch (error) {
    var known = BalaaCore.demoError(error);
    if (known) return known;
    console.error(error && error.stack ? error.stack : error);
    return { status: 500, body: { error: 'تعذر إتمام الطلب. حاول مرة أخرى.' } };
  } finally {
    lock.releaseLock();
  }
}

// ---------- Storage ----------

function openStore() {
  var props = PropertiesService.getScriptProperties();
  var folder = byId(DriveApp.getFolderById, props.getProperty('FOLDER_ID'));
  if (!folder) {
    folder = DriveApp.createFolder('Balaa · بلاعة');
    props.setProperty('FOLDER_ID', folder.getId());
  }
  var file = byId(DriveApp.getFileById, props.getProperty('STATE_FILE_ID'));
  return {
    folder: folder,
    load: function () {
      if (!file) return BalaaCore.seed(false);
      return JSON.parse(file.getBlob().getDataAsString('UTF-8'));
    },
    save: function (state) {
      var json = JSON.stringify(state);
      if (file) file.setContent(json);
      else {
        file = folder.createFile('balaa-state.json', json, 'application/json');
        props.setProperty('STATE_FILE_ID', file.getId());
      }
    },
    photos: function () {
      var existing = byId(DriveApp.getFolderById, props.getProperty('PHOTOS_FOLDER_ID'));
      if (existing) return existing;
      var created = folder.createFolder('photos');
      props.setProperty('PHOTOS_FOLDER_ID', created.getId());
      return created;
    },
    sheet: function () {
      var existing = byId(SpreadsheetApp.openById, props.getProperty('SHEET_ID'));
      if (existing) return existing;
      var created = SpreadsheetApp.create('Balaa · Reports');
      DriveApp.getFileById(created.getId()).moveTo(folder);
      props.setProperty('SHEET_ID', created.getId());
      return created;
    },
  };
}

function byId(open, id) {
  if (!id) return null;
  try {
    return open(id);
  } catch (error) {
    return null;
  }
}

/** Moves newly uploaded photos out of the data file into their own Drive files. */
function storePhotos(state, store) {
  state.media.forEach(function (media) {
    if (!media.data || media.driveId) return;
    var blob = Utilities.newBlob(
      Utilities.base64Decode(media.data),
      'image/jpeg',
      media.kind + '-' + media.id + '.jpg',
    );
    var file = store.photos().createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    media.driveId = file.getId();
    media.data = '';
  });
}

/** Public image address for every /api/media/<id> the response mentions. */
function mediaUrls(state, body) {
  var urls = {};
  var text = JSON.stringify(body || {});
  var pattern = /\/api\/media\/([0-9a-f-]{36})/g;
  var match;
  while ((match = pattern.exec(text))) {
    var id = match[1];
    var media = state.media.filter(function (m) {
      return m.id === id;
    })[0];
    if (media && media.driveId)
      urls[id] = 'https://drive.google.com/thumbnail?id=' + media.driveId + '&sz=w1600';
  }
  return urls;
}

// ---------- Readable spreadsheet ----------

function mirror(state, store) {
  var sheet = store.sheet();
  var categories = {};
  state.categories.forEach(function (c) {
    categories[c.id] = c.labelAr;
  });
  var statuses = {
    submitted: 'تم الإبلاغ',
    delivered: 'تم الإرسال',
    acknowledged: 'تم الاستلام',
    in_progress: 'جارٍ العمل',
    resolved: 'تم الحل',
    rejected: 'مرفوض',
    duplicate: 'بلاغ مكرر',
    under_review: 'تحت المراجعة',
  };
  var photo = function (url) {
    var id = String(url || '')
      .split('/')
      .pop();
    var media = state.media.filter(function (m) {
      return m.id === id;
    })[0];
    return media && media.driveId ? 'https://drive.google.com/file/d/' + media.driveId : '';
  };
  writeTab(
    sheet,
    'البلاغات',
    [
      'رقم البلاغ',
      'التاريخ',
      'النوع',
      'الحي',
      'الخطورة',
      'الحالة',
      'تأكيدات',
      'الوصف',
      'خط العرض',
      'خط الطول',
      'صورة المشكلة',
      'صورة الحل',
      'ملاحظة الحل',
    ],
    state.reports.map(function (r) {
      return [
        r.publicId,
        r.createdAt,
        categories[r.categoryId] || r.categoryId,
        r.districtName,
        r.severity,
        statuses[r.status] || r.status,
        r.confirmationUserIds.length,
        r.description || '',
        r.latitude,
        r.longitude,
        photo(r.imageUrl),
        photo(r.resolutionImageUrl),
        r.resolutionNote || '',
      ];
    }),
  );
  var reports = {};
  state.reports.forEach(function (r) {
    reports[r.id] = r.publicId;
  });
  writeTab(
    sheet,
    'الرسائل (لم تُرسل)',
    ['التاريخ', 'البلاغ', 'إلى', 'من', 'الموضوع', 'الحالة'],
    state.notifications
      .slice()
      .reverse()
      .map(function (n) {
        var to = n.audience === 'citizen' ? BalaaCore.maskEmail(n.intendedTo) : n.intendedTo;
        return [
          n.createdAt,
          reports[n.reportId] || '',
          to || n.to,
          n.from || '',
          n.subject,
          'لم تُرسل · وضع تجريبي',
        ];
      }),
  );
  var first = sheet.getSheetByName('Sheet1') || sheet.getSheetByName('ورقة1');
  if (first && sheet.getSheets().length > 1) sheet.deleteSheet(first);
}

function writeTab(spreadsheet, name, header, rows) {
  var tab = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  tab.clearContents();
  tab.setRightToLeft(true);
  var values = [header].concat(rows);
  tab.getRange(1, 1, values.length, header.length).setValues(values);
  tab.setFrozenRows(1);
}

// ---------- Sessions ----------

function hashToken(token) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(token))
    .map(function (b) {
      return ('0' + (b & 0xff).toString(16)).slice(-2);
    })
    .join('');
}

function sessionUser(state, token) {
  if (!token) return null;
  var hash = hashToken(token);
  var now = Date.now();
  var session = state.sessions.filter(function (s) {
    return s.hash === hash && Date.parse(s.expiresAt) > now;
  })[0];
  if (!session) return null;
  return (
    state.users.filter(function (u) {
      return u.id === session.userId;
    })[0] || null
  );
}

function issueSession(state, user) {
  var token = Utilities.getUuid() + Utilities.getUuid();
  var now = Date.now();
  state.sessions = state.sessions.filter(function (s) {
    return Date.parse(s.expiresAt) > now;
  });
  state.sessions.push({
    hash: hashToken(token),
    userId: user.id,
    expiresAt: new Date(now + SESSION_DAYS * 86400000).toISOString(),
  });
  return token;
}
