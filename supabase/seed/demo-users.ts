/** Local Supabase only. Uses the Auth Admin API, never inserts password hashes manually. */
const baseUrl = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_SEED_PASSWORD;
const url = new URL(baseUrl);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
  throw new Error('Demo users may only be created on a local Supabase instance');
if (!key || !password || password.length < 12)
  throw new Error(
    'Set SUPABASE_SERVICE_ROLE_KEY and a DEMO_SEED_PASSWORD of at least 12 characters',
  );
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
async function request(path: string, method: string, body?: unknown): Promise<unknown> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok)
    throw new Error(`${method} ${path}: HTTP ${response.status}; inspect local Supabase logs`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
const demoAccounts = [
  { email: 'citizen@balaa.invalid', role: 'citizen' },
  { email: 'agent-maadi@balaa.invalid', role: 'district_agent', district: 'maadi' },
  { email: 'manager-maadi@balaa.invalid', role: 'district_manager', district: 'maadi' },
  { email: 'agent-nasr@balaa.invalid', role: 'district_agent', district: 'nasr-city' },
  { email: 'moderator@balaa.invalid', role: 'moderator' },
  { email: 'admin@balaa.invalid', role: 'platform_admin' },
];
const existing = (await request('/auth/v1/admin/users?page=1&per_page=1000', 'GET')) as {
  users: { id: string; email: string }[];
};
for (const account of demoAccounts) {
  let user = existing.users.find((u) => u.email === account.email);
  if (!user)
    user = (await request('/auth/v1/admin/users', 'POST', {
      email: account.email,
      password,
      email_confirm: true,
    })) as { id: string; email: string };
  await request(`/rest/v1/users?id=eq.${user.id}`, 'PATCH', { role: account.role, verified: true });
  if (account.district) {
    const districts = (await request(
      `/rest/v1/districts?slug=eq.${account.district}&select=id`,
      'GET',
    )) as { id: string }[];
    if (!districts[0]) throw new Error(`Run database seed first: missing ${account.district}`);
    const memberships = (await request(
      `/rest/v1/district_memberships?user_id=eq.${user.id}&district_id=eq.${districts[0].id}&select=user_id`,
      'GET',
    )) as unknown[];
    if (!memberships.length)
      await request('/rest/v1/district_memberships', 'POST', {
        user_id: user.id,
        district_id: districts[0].id,
      });
  }
  console.log(`Ready: ${account.email} (${account.role})`);
}
console.log('Local demo accounts created. Passwords and service-role keys are never printed.');
