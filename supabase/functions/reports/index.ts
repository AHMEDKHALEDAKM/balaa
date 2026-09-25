import {
  choice,
  handle,
  HttpError,
  number,
  object,
  onlyKeys,
  text,
  timestamp,
  uuid,
} from '../_shared/http.ts';

const states = [
  'submitted',
  'delivered',
  'acknowledged',
  'in_progress',
  'resolved',
  'rejected',
  'duplicate',
  'under_review',
] as const;
const moderation = ['safe', 'flagged', 'blocked'] as const;
Deno.serve((request) =>
  handle(request, async (body, client) => {
    const action = text(body.action, 32);
    switch (action) {
      case 'submit': {
        onlyKeys(body, ['action', 'input']);
        const input = object(body.input);
        onlyKeys(input, [
          'category_slug',
          'description',
          'severity',
          'latitude',
          'longitude',
          'captured_latitude',
          'captured_longitude',
          'gps_accuracy',
          'captured_at',
          'device_timestamp',
          'original_path',
        ]);
        const path = text(input.original_path, 180);
        if (!path.startsWith(client.userId + '/') || path.includes('..'))
          throw new HttpError(400, 'Owned image path required');
        return await client.rpc('submit_report', {
          input: {
            category_slug: text(input.category_slug, 50),
            description: text(input.description ?? '', 500, 0),
            severity: choice(input.severity, ['normal', 'dangerous', 'critical']),
            latitude: number(input.latitude, -90, 90),
            longitude: number(input.longitude, -180, 180),
            captured_latitude: number(input.captured_latitude, -90, 90),
            captured_longitude: number(input.captured_longitude, -180, 180),
            gps_accuracy: number(input.gps_accuracy, 0.01, 200),
            captured_at: timestamp(input.captured_at),
            device_timestamp: timestamp(input.device_timestamp),
            original_path: path,
          },
        });
      }
      case 'confirm':
        onlyKeys(body, ['action', 'report_id']);
        return await client.rpc('confirm_report', { report_id: uuid(body.report_id) });
      case 'transition':
        onlyKeys(body, [
          'action',
          'report_id',
          'new_status',
          'note',
          'resolution_image_id',
          'duplicate_of',
        ]);
        return await client.rpc('transition_report', {
          report_id: uuid(body.report_id),
          new_status: choice(body.new_status, states),
          note: text(body.note ?? '', 2000, 0),
          resolution_image_id: body.resolution_image_id ? uuid(body.resolution_image_id) : null,
          duplicate_of: body.duplicate_of ? uuid(body.duplicate_of) : null,
        });
      case 'resolve_district':
        onlyKeys(body, ['action', 'lng', 'lat']);
        return await client.rpc('resolve_district', {
          lng: number(body.lng, -180, 180),
          lat: number(body.lat, -90, 90),
        });
      case 'duplicates':
        onlyKeys(body, ['action', 'category_slug', 'lng', 'lat']);
        return await client.rpc('find_duplicate_reports', {
          category_slug: text(body.category_slug, 50),
          lng: number(body.lng, -180, 180),
          lat: number(body.lat, -90, 90),
        });
      case 'register_image':
        onlyKeys(body, ['action', 'report_id', 'object_path']);
        return await client.rpc('register_report_image', {
          report_id: uuid(body.report_id),
          object_path: text(body.object_path, 180),
          kind: 'after',
        });
      case 'moderate_report':
        onlyKeys(body, ['action', 'report_id', 'decision', 'note']);
        return await client.rpc('moderate_report', {
          report_id: uuid(body.report_id),
          decision: choice(body.decision, moderation),
          note: text(body.note),
        });
      case 'moderate_image':
        onlyKeys(body, [
          'action',
          'image_id',
          'decision',
          'note',
          'derivative_path',
          'redaction_confirmed',
        ]);
        if (body.redaction_confirmed !== undefined && typeof body.redaction_confirmed !== 'boolean')
          throw new HttpError(400, 'Invalid redaction confirmation');
        return await client.rpc('moderate_image', {
          image_id: uuid(body.image_id),
          decision: choice(body.decision, moderation),
          note: text(body.note),
          derivative_path: body.derivative_path ? text(body.derivative_path, 180) : null,
          redaction_confirmed: body.redaction_confirmed ?? false,
        });
      case 'note':
        onlyKeys(body, ['action', 'report_id', 'note']);
        return await client.rpc('add_internal_note', {
          report_id: uuid(body.report_id),
          note: text(body.note),
        });
      case 'image_url': {
        onlyKeys(body, ['action', 'image_id', 'variant']);
        const original = choice(body.variant, ['original', 'public']) === 'original';
        const pathColumn = original ? 'original_path' : 'public_path';
        const query = new URLSearchParams({
          id: `eq.${uuid(body.image_id)}`,
          select: pathColumn,
          limit: '1',
        });
        let result = await client.read(original ? 'report_images' : 'public_report_images', query);
        if (!original && Array.isArray(result) && result.length === 0)
          result = await client.read('district_report_images', query);
        if (!Array.isArray(result) || !result[0]) throw new HttpError(404, 'Image not available');
        const path = text(object(result[0])[pathColumn], 180);
        return await client.signImage(original ? 'report-originals' : 'report-derivatives', path);
      }
      default:
        throw new HttpError(400, 'Unknown report action');
    }
  }),
);
