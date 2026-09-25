import { handle, HttpError, number, onlyKeys } from '../_shared/http.ts';
Deno.serve((request) =>
  handle(request, async (body, client) => {
    onlyKeys(body, ['batch_size']);
    if ((Deno.env.get('EMAIL_MODE') ?? 'test') !== 'test')
      throw new HttpError(503, 'Production email transport is not implemented');
    const batch = number(body.batch_size ?? 25, 1, 100);
    if (!Number.isInteger(batch)) throw new HttpError(400, 'Batch size must be an integer');
    // Platform-admin authorization is enforced in SQL. Stores a test outbox row;
    // there is no SMTP/HTTP email provider here and no real recipient transmission.
    return await client.rpc('process_test_notifications', { batch_size: batch });
  }),
);
