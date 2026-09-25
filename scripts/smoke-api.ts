import assert from 'node:assert/strict';
import sharp from 'sharp';
const base = process.env.BALAA_TEST_URL || 'http://localhost:3000';
async function call(path: string, body?: unknown, token?: string, expected = 200) {
  const response = await fetch(`${base}/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const value = await response.json();
  assert.equal(response.status, expected, `${path}: ${JSON.stringify(value)}`);
  return value;
}
async function main() {
  const picture = await sharp({
    create: { width: 100, height: 100, channels: 3, background: '#8caaa0' },
  })
    .jpeg()
    .toBuffer();
  const dataUrl = `data:image/jpeg;base64,${picture.toString('base64')}`;
  const citizen = await call('auth/mock', {});
  const token = citizen.token as string;
  const { imageUrl } = await call('media', { dataUrl, kind: 'before' }, token, 201);
  const capture = {
    categoryId: 'pothole',
    severity: 'dangerous',
    description: 'اختبار الرحلة الكاملة',
    latitude: 29.9602,
    longitude: 31.2569,
    gpsAccuracy: 8,
    capturedAt: new Date().toISOString(),
    imageUrl,
  };
  const { report } = await call('reports', capture, token, 201);
  assert.match(report.publicId, /^BLAA-\d{6,}$/);
  const publicReport = await call(`public/reports/${report.id}`);
  assert.equal(publicReport.report.status, 'delivered');
  assert.equal('userId' in publicReport.report, false);
  const other = await call('auth/mock', {});
  await call(`reports/${report.id}/confirm`, {}, other.token);
  const confirmed = await call(`reports/${report.id}/confirm`, {}, other.token);
  assert.equal(confirmed.report.confirmationCount, 1);
  await call(
    `dashboard/reports/${report.id}/status`,
    { status: 'acknowledged', note: 'attempt' },
    token,
    403,
  );
  const staff = await call('auth/staff', { role: 'district_agent' });
  const scoped = await call('dashboard/reports', undefined, staff.token);
  assert.ok(scoped.reports.every((r: { districtId: string }) => r.districtId === 'maadi'));
  const outsiders = await call('public/reports');
  const outside = outsiders.reports.find(
    (r: { districtId: string }) => r.districtId === 'nasr-city',
  );
  assert.ok(outside);
  await call(
    `dashboard/reports/${outside.id}/status`,
    { status: 'acknowledged', note: 'wrong district' },
    staff.token,
    403,
  );
  await call(
    `dashboard/reports/${report.id}/status`,
    { status: 'acknowledged', note: 'استلمنا البلاغ' },
    staff.token,
  );
  await call(
    `dashboard/reports/${report.id}/status`,
    { status: 'in_progress', note: 'بدأ الإصلاح' },
    staff.token,
  );
  await call(
    `dashboard/reports/${report.id}/status`,
    { status: 'resolved', note: 'تم الإصلاح' },
    staff.token,
    400,
  );
  const after = await call('media', { dataUrl, kind: 'resolution' }, staff.token, 201);
  await call(
    `dashboard/reports/${report.id}/status`,
    { status: 'resolved', note: 'تم الإصلاح', imageUrl: after.imageUrl },
    staff.token,
  );
  const resolved = await call(`public/reports/${report.id}`);
  assert.equal(resolved.report.status, 'resolved');
  assert.ok(resolved.report.resolutionImageUrl);
  assert.ok(resolved.report.imageUrl);
  const nextMedia = await call('media', { dataUrl, kind: 'before' }, token, 201);
  const flagged = await call(
    'reports',
    { ...capture, imageUrl: nextMedia.imageUrl, description: '[flag] privacy review' },
    token,
    201,
  );
  await call(`public/reports/${flagged.report.id}`, undefined, undefined, 404);
  const hidden = await fetch(`${base}${nextMedia.imageUrl}`);
  assert.equal(hidden.status, 404);
  const admin = await call('auth/staff', { role: 'platform_admin' });
  const outbox = await call('admin/outbox', undefined, admin.token);
  assert.ok(
    outbox.notifications.every(
      (n: { to: string; status: string }) =>
        n.to.endsWith('.invalid') && n.status === 'test_captured',
    ),
  );
  assert.ok(
    !outbox.notifications.some((n: { reportId: string }) => n.reportId === flagged.report.id),
  );
  await call(
    `moderation/${flagged.report.id}`,
    { decision: 'safe', note: 'تمت المراجعة' },
    admin.token,
  );
  await call(`public/reports/${flagged.report.id}`);
  console.log(
    'PASS: identity → capture → routing → report → test inbox → public tracking → district scope → resolution → before/after; privacy, moderation and duplicate confirmations.',
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
