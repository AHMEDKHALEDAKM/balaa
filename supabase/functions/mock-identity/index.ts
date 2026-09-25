import { handle, HttpError, onlyKeys } from '../_shared/http.ts';
Deno.serve((request) =>
  handle(request, async (body, client) => {
    onlyKeys(body, []);
    if (
      Deno.env.get('AUTH_PROVIDER') !== 'digital_egypt_mock' ||
      Deno.env.get('ENABLE_MOCK_IDENTITY') !== 'true'
    ) {
      throw new HttpError(
        403,
        'Mock identity is disabled; authorized Digital Egypt integration is not implemented',
      );
    }
    // The RPC also checks a database-owned environment flag. No user-supplied
    // national ID or external provider identifier is accepted or collected.
    return await client.rpc('complete_mock_verification', {});
  }),
);
