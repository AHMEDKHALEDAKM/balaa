// Server-only demo sessions. The phone demo keeps its signed-in user on the device instead.
import { createHash, randomBytes } from 'node:crypto';
import type { User } from '@balaa/types';
import type { State } from './state';
export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
export function sessionUser(state: State, token: string | null) {
  if (!token) return null;
  const session = state.sessions.find(
    (s) => s.hash === hashToken(token) && Date.parse(s.expiresAt) > Date.now(),
  );
  return session ? state.users.find((u) => u.id === session.userId) || null : null;
}
export function issueSession(state: State, user: User) {
  const token = randomBytes(32).toString('base64url');
  state.sessions = state.sessions.filter((s) => Date.parse(s.expiresAt) > Date.now());
  state.sessions.push({
    hash: hashToken(token),
    userId: user.id,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });
  return { user, token };
}
