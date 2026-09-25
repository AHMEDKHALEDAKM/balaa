import { beforeEach, describe, expect, it } from 'vitest';
import { initialCategories } from '@balaa/config';
import type { User } from '@balaa/types';
import type { State } from '../apps/dashboard/src/server/store';
import {
  canManage,
  canRead,
  confirmReport,
  dto,
  duplicateReports,
  issueSession,
  moderateReport,
  sessionUser,
  submitReport,
  transitionReport,
} from '../apps/dashboard/src/server/service';
const citizen: User = { id: 'citizen-a', role: 'citizen', verified: true, districtIds: [] };
const agent: User = {
  id: 'agent-a',
  role: 'district_agent',
  verified: true,
  districtIds: ['maadi'],
};
const outsider: User = {
  id: 'agent-b',
  role: 'district_agent',
  verified: true,
  districtIds: ['nasr-city'],
};
const moderator: User = { id: 'moderator', role: 'moderator', verified: true, districtIds: [] };
let state: State;
function media(id = 'capture', ownerId = citizen.id, kind: 'before' | 'resolution' = 'before') {
  state.media.push({ id, ownerId, kind, data: '', createdAt: new Date().toISOString() });
  return `/api/media/${id}`;
}
function input(extra: Record<string, unknown> = {}) {
  return {
    categoryId: 'pothole',
    severity: 'normal',
    description: 'تجربة',
    latitude: 29.96021,
    longitude: 31.26034,
    gpsAccuracy: 12,
    capturedAt: new Date().toISOString(),
    imageUrl: media(`m${state.media.length}`),
    ...extra,
  };
}
beforeEach(() => {
  state = {
    version: 1,
    sequence: 0,
    users: [citizen, agent, outsider, moderator],
    sessions: [],
    reports: [],
    categories: initialCategories.map((c) => ({ ...c })),
    media: [],
    notifications: [],
    audit: [],
    rateLimits: {},
    identityVerifications: [],
  };
});
describe('Reports and access', () => {
  it('creates public ID, server district, history and an inert test notification', async () => {
    const r = await submitReport(state, citizen, input());
    expect(r.publicId).toBe('BLAA-000001');
    expect(r.districtId).toBe('maadi');
    expect(r.history.map((h) => h.status)).toEqual(['submitted', 'delivered']);
    expect(state.notifications[0]?.to).toBe('preview@balaa.invalid');
  });
  it('requires authenticated verified citizens', async () => {
    await expect(submitReport(state, null, input())).rejects.toMatchObject({ status: 401 });
    await expect(submitReport(state, agent, input())).rejects.toMatchObject({ status: 403 });
    await expect(
      submitReport(state, { ...citizen, verified: false }, input()),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('rejects unsupported locations and stale captures', async () => {
    await expect(submitReport(state, citizen, input({ latitude: 0 }))).rejects.toMatchObject({
      status: 422,
    });
    await expect(
      submitReport(state, citizen, input({ capturedAt: '2020-01-01T00:00:00.000Z' })),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('requires owned, unconsumed photo evidence', async () => {
    await expect(
      submitReport(state, citizen, input({ imageUrl: media('stolen', 'other') })),
    ).rejects.toMatchObject({ status: 400 });
    const body = input();
    await submitReport(state, citizen, body);
    await expect(submitReport(state, citizen, body)).rejects.toMatchObject({ status: 400 });
  });
  it('never publishes or notifies flagged reports', async () => {
    const r = await submitReport(state, citizen, input({ description: '[flag] test' }));
    expect(r.status).toBe('under_review');
    expect(state.notifications).toHaveLength(0);
    expect(canRead(null, state.reports[0]!)).toBe(false);
    expect(canRead(citizen, state.reports[0]!)).toBe(true);
  });
  it('moderator approval releases the report and notification once', async () => {
    const r = await submitReport(state, citizen, input({ description: '[flag] test' }));
    await expect(moderateReport(state, agent, r.id, 'safe', 'reviewed')).rejects.toMatchObject({
      status: 403,
    });
    await moderateReport(state, moderator, r.id, 'safe', 'reviewed');
    await moderateReport(state, moderator, r.id, 'safe', 'reviewed');
    expect(state.notifications).toHaveLength(1);
  });
  it('allowlists public data and removes internal history notes', async () => {
    await submitReport(state, citizen, input());
    const r = state.reports[0]!;
    r.internalNotes.push({ actorId: 'a', note: 'private', createdAt: new Date().toISOString() });
    const publicData = dto(state, r);
    expect(publicData.latitude).toBe(29.96);
    expect(JSON.stringify(publicData)).not.toMatch(
      /citizen-a|userId|providerSubject|internalNotes|actorId/,
    );
    expect(publicData.history.every((h) => !h.note)).toBe(true);
  });
  it('limits staff to their district', async () => {
    const r = await submitReport(state, citizen, input());
    expect(canManage(agent, state.reports[0]!)).toBe(true);
    expect(canManage(outsider, state.reports[0]!)).toBe(false);
    await expect(
      transitionReport(state, outsider, r.id, { status: 'acknowledged', note: 'reviewed' }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('finds only same-category open candidates within 30m', async () => {
    await submitReport(state, citizen, input());
    expect(
      duplicateReports(state, { latitude: 29.96021, longitude: 31.26035, categoryId: 'pothole' }),
    ).toHaveLength(1);
    expect(
      duplicateReports(state, { latitude: 29.97, longitude: 31.26, categoryId: 'pothole' }),
    ).toHaveLength(0);
    expect(
      duplicateReports(state, { latitude: 29.96021, longitude: 31.26035, categoryId: 'waste' }),
    ).toHaveLength(0);
  });
  it('confirmation is idempotent and disallows own report', async () => {
    const r = await submitReport(state, citizen, input());
    expect(() => confirmReport(state, citizen, r.id)).toThrow();
    const other = { ...citizen, id: 'citizen-b' };
    confirmReport(state, other, r.id);
    confirmReport(state, other, r.id);
    expect(state.reports[0]!.confirmationUserIds).toHaveLength(1);
  });
  it('requires note and resolution image and preserves before/after', async () => {
    const r = await submitReport(state, citizen, input());
    await expect(
      transitionReport(state, agent, r.id, { status: 'resolved', note: 'fixed' }),
    ).rejects.toMatchObject({ status: 409 });
    await transitionReport(state, agent, r.id, { status: 'acknowledged', note: 'received' });
    await transitionReport(state, agent, r.id, { status: 'in_progress', note: 'working' });
    await expect(
      transitionReport(state, agent, r.id, { status: 'resolved', note: 'fixed' }),
    ).rejects.toMatchObject({ status: 400 });
    const result = await transitionReport(state, agent, r.id, {
      status: 'resolved',
      note: 'تم الإصلاح',
      imageUrl: media('after', agent.id, 'resolution'),
    });
    expect(result.resolutionImageUrl).toBe('/api/media/after');
    expect(result.imageUrl).toBe(r.imageUrl);
    expect(state.reports[0]!.resolvedBy).toBe(agent.id);
    expect(state.notifications).toHaveLength(2);
  });
  it('does not publish flagged resolution evidence', async () => {
    const r = await submitReport(state, citizen, input());
    await transitionReport(state, agent, r.id, { status: 'acknowledged', note: 'received' });
    await transitionReport(state, agent, r.id, { status: 'in_progress', note: 'working' });
    await expect(
      transitionReport(state, agent, r.id, {
        status: 'resolved',
        note: '[flag] content',
        imageUrl: media('after', agent.id, 'resolution'),
      }),
    ).rejects.toMatchObject({ status: 422 });
    expect(state.reports[0]!.status).toBe('in_progress');
  });
  it('enforces hourly submissions and temporary suspensions', async () => {
    for (let i = 0; i < 10; i++) await submitReport(state, citizen, input());
    await expect(submitReport(state, citizen, input())).rejects.toMatchObject({ status: 429 });
    await expect(
      submitReport(
        state,
        { ...citizen, suspendedUntil: new Date(Date.now() + 3600000).toISOString() },
        input(),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('stores only token hashes and expires sessions', () => {
    const { token } = issueSession(state, citizen);
    expect(state.sessions[0]!.hash).not.toBe(token);
    expect(sessionUser(state, token)?.id).toBe(citizen.id);
    state.sessions[0]!.expiresAt = '2020-01-01T00:00:00Z';
    expect(sessionUser(state, token)).toBeNull();
  });
});
