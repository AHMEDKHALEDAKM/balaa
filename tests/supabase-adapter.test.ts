import { afterEach, describe, expect, it, vi } from 'vitest';
import { SupabaseGateway } from '../apps/dashboard/src/server/supabase';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
function gateway(token: string | null = 'citizen-jwt') {
  vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('SUPABASE_ANON_KEY', 'public-anon-key');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'must-never-be-read');
  return new SupabaseGateway(token);
}
describe('Supabase caller authorization transport', () => {
  it('forwards caller JWT and anon apikey, never service-role credentials', async () => {
    const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal('fetch', mock);
    await gateway().rpc('confirm_report', { report_id: 'example' });
    const [, options] = mock.mock.calls[0]!;
    expect(options.headers).toMatchObject({
      Authorization: 'Bearer citizen-jwt',
      apikey: 'public-anon-key',
    });
    expect(JSON.stringify(mock.mock.calls)).not.toContain('must-never-be-read');
  });
  it('uses anon role for public projections', async () => {
    const mock = vi.fn().mockResolvedValue(new Response('[]'));
    vi.stubGlobal('fetch', mock);
    await gateway(null).read('public_reports');
    expect(mock.mock.calls[0]![1].headers.Authorization).toBe('Bearer public-anon-key');
  });
  it('fails when settings are missing', () => {
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_ANON_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    expect(() => new SupabaseGateway(null)).toThrow();
  });
  it('maps database authorization failures to forbidden', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: '42501', message: 'District access denied' }), {
          status: 400,
        }),
      ),
    );
    await expect(gateway().rpc('transition_report', {})).rejects.toMatchObject({ status: 403 });
  });
  it('unwraps Edge Function results', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ data: { public_id: 'BLAA-000001' } }))),
    );
    expect(await gateway().edge('reports', { action: 'submit' })).toEqual({
      public_id: 'BLAA-000001',
    });
  });
});
