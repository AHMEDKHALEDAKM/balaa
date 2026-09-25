# Balaa mobile

Arabic citizen application built with Expo SDK 57 and React Native. All labels and primary reading flow are right-to-left. Explicit row ordering and Arabic text directions keep the experience predictable on phones configured in either Arabic or English.

## Run

Install dependencies from the repository root with `npm install`. Start the dashboard/API in a separate terminal, then:

```sh
cp apps/mobile/.env.example apps/mobile/.env
npm run start --workspace @balaa/mobile
```

Set `EXPO_PUBLIC_API_URL` to a URL the **phone** can reach. A physical device uses the computer's LAN IP (for example `http://192.168.1.10:3000`); the Android emulator normally uses `http://10.0.2.2:3000`. `localhost` points at the device itself. The phone and development server must be on the same reachable network. Never put secrets in `EXPO_PUBLIC_` variables.

Use a matching Expo Go SDK or a development build. Native build commands are `npm run android --workspace @balaa/mobile` and `npm run ios --workspace @balaa/mobile` (iOS native builds require macOS/Xcode). This is a native Android/iOS client; use the dashboard citizen experience for browser demonstrations.

```sh
npm run typecheck --workspace @balaa/mobile
```

## Journey

Onboarding → home/public MapLibre map → mock identity → direct camera → foreground GPS → server polygon lookup → location confirmation → editable server categories and severity → privacy review → duplicate check → submission → status/history and before/after images.

- Mock identity is visibly labeled throughout. No national ID, official logo or government password is requested.
- Only the server-issued demo bearer token and demo account are saved in native SecureStore. On restart the token is checked against `/api/auth/session`.
- The camera opens directly. Photos are resized to at most 1280 pixels wide and recompressed as JPEG before upload. EXIF is not requested or used for routing. **Recompression is not face/license-plate redaction.** The server moderation boundary remains authoritative.
- GPS requires foreground permission and an actual location fix. Permission, offline, unsupported location and poor-accuracy states are visible. Coordinates are never silently replaced with Cairo.
- Location correction is bounded to 50 meters from the original fix, in 10-meter steps. Each correction reruns the server district lookup. Device coordinates/timestamps are evidence, not tamper-proof verification.
- Categories are fetched from `/api/categories`; there is no embedded authoritative category list.
- Description is limited to 500 characters; a synthetic-location label, when used in development, counts toward this limit.
- Same-category open reports within 30m are offered for confirmation. Confirmation does not create a new report.
- Private image requests carry the bearer header only to the configured API origin. Public share links contain no session credentials.
- My Reports/current report refresh while open every 15 seconds and when returning to the foreground; pull-to-refresh is also available. There are no system push notifications or SMS in this prototype.

## Maps

`react-native-webview` hosts the dashboard's MapLibre map at `/map?embed=1`. Location previews pass `latitude` and `longitude`. The map can open a native report detail by sending `window.ReactNativeWebView.postMessage(JSON.stringify({type: 'report', id}))`. Navigation is restricted to the configured API origin. A recoverable map error shows a retry and external-browser link. Tile-service attribution remains in the embedded map.

## Development fixtures and limits

Only development builds (`__DEV__`) expose gallery selection and **explicitly synthetic** Maadi coordinates (`29.9602, 31.2569`). The synthetic action is available after choosing/capturing a photo; its use is visible during review and prefixed into the report description. It is never a fallback for failed GPS. Release flows require a fresh camera capture and a real foreground GPS fix.

Boundaries, identities, authority delivery and moderation are demonstrations. Local Cairo polygons do not provide operational district routing. All delivery remains in the test outbox. A phone outside a supported demo polygon is correctly rejected by the server; this is expected.

TypeScript and Metro bundling can be checked without native hardware. Actual camera permissions, GPS accuracy, denied-permission recovery, low-memory behavior and background/foreground behavior require physical-device testing before a pilot.
