import type { Category, ModerationStatus } from '@balaa/types';
export interface IdentityResult {
  provider: string;
  verificationMode: 'demo' | 'authorized';
  verified: boolean;
  providerSubjectId: string;
}
export interface IdentityProvider {
  readonly name: string;
  verify(subject: string): Promise<IdentityResult>;
}
export class MockDigitalEgyptProvider implements IdentityProvider {
  readonly name = 'digital_egypt_mock';
  async verify(subject: string): Promise<IdentityResult> {
    return {
      provider: this.name,
      verificationMode: 'demo',
      verified: true,
      providerSubjectId: `demo-${subject}`,
    };
  }
}
/** Contract only. An authorized implementation must validate signed callbacks server-side. */
export interface DigitalEgyptProvider extends IdentityProvider {
  authorizationUrl(state: string, nonce: string): Promise<string>;
  exchangeAuthorizedCallback(code: string, state: string): Promise<IdentityResult>;
}
export function identityProvider(name = 'digital_egypt_mock'): IdentityProvider {
  if (name !== 'digital_egypt_mock')
    throw new Error('Authorized identity integration has not been implemented');
  return new MockDigitalEgyptProvider();
}
export interface ModerationProvider {
  review(input: {
    description: string;
    imageUrl: string;
  }): Promise<{ state: ModerationStatus; reason: string }>;
}
export class DemoModerationProvider implements ModerationProvider {
  async review(input: { description: string; imageUrl: string }) {
    const flagged = /\[flag\]|\[block\]|رقم قومي|national.?id|\b\d{14}\b/i.test(input.description);
    return {
      state: (flagged ? 'flagged' : 'safe') as ModerationStatus,
      reason: flagged
        ? 'Demonstration rule requires human review'
        : 'Demo text rules only; image content has not been classified',
    };
  }
}
export interface NotificationMessage {
  reportId: string;
  to: string;
  subject: string;
  body: string;
}
export interface NotificationProvider {
  send(message: NotificationMessage): Promise<{ destination: string; status: 'test_captured' }>;
}
export class TestInboxProvider implements NotificationProvider {
  constructor(private readonly inbox = 'preview@balaa.invalid') {
    if (!inbox.endsWith('.invalid'))
      throw new Error('Test inbox must use reserved .invalid domain');
  }
  async send(
    _message: NotificationMessage,
  ): Promise<{ destination: string; status: 'test_captured' }> {
    return { destination: this.inbox, status: 'test_captured' };
  }
}
export function notificationProvider(mode = 'test', inbox?: string): NotificationProvider {
  if (mode !== 'test')
    throw new Error(
      'Production delivery requires a separately reviewed provider; no transport is configured',
    );
  return new TestInboxProvider(inbox);
}
export const initialCategories: Category[] = [
  ['manhole', 'بلاعة مفتوحة أو مكسورة', 'Broken/open manhole', 'circle-dot'],
  ['pothole', 'حفرة في الطريق', 'Pothole', 'construction'],
  ['speed-bump', 'مطب تالف أو مكسور', 'Damaged speed bump', 'triangle'],
  ['road-surface', 'تلف في الأسفلت', 'Road surface damage', 'route'],
  ['pavement', 'تلف في الرصيف', 'Pavement damage', 'footprints'],
  ['water', 'مياه أو صرف صحي', 'Water/sewage issue', 'droplets'],
  ['obstruction', 'عائق في الطريق', 'Road obstruction', 'barrier'],
  ['lighting', 'إنارة طريق', 'Street-lighting issue', 'lamp'],
  ['waste', 'مخلفات أو قمامة', 'Waste', 'trash'],
  ['other', 'أخرى', 'Other', 'circle'],
].map(([id, labelAr, labelEn, icon]) => ({
  id: id!,
  labelAr: labelAr!,
  labelEn: labelEn!,
  icon: icon!,
  active: true,
}));
