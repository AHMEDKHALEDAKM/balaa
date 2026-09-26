# GitHub and phone installation

This guide covers both Android and iPhone. GitHub stores source code; it does not automatically build or host the Balaa backend. A source ZIP cannot be installed as a mobile application.

## 1. Put the source on GitHub

The supplied `balaa` directory already contains a local Git repository. Use that directory, not the parent `outputs` directory. If using the ZIP on a different computer, extract it and run `git init`, `git add .`, and `git commit -m "Initial Balaa prototype"` first. Install Git and sign in to GitHub using its normal browser/device login. Never paste a password or access token into a command or source file.

Create a new, empty repository on GitHub. Choose its visibility; leave README, license and .gitignore initialization unchecked because these already exist locally. Replace YOUR-USERNAME below with your account or organization:

```powershell
cd "C:\Users\ahmed\Documents\Codex\2026-09-25\i-x20\outputs\balaa"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/balaa.git
git push -u origin main
```

If `origin` already exists, inspect `git remote -v` and change it only to your intended destination using `git remote set-url origin ...`. If the destination already contains commits, clone it and integrate the files; do not force-push over someone else's history.

Before pushing, `git status` and `git ls-files` should show only source, docs and supplied brand assets. `.env`, `.balaa`, node_modules, native build output, signing credentials and local report uploads are ignored. Review ownership/licensing of the supplied logo before distributing it publicly. Its rights are not implied by the software's MIT license.

To download the code on another computer:

```sh
git clone https://github.com/YOUR-USERNAME/balaa.git
cd balaa
npm ci
npm run dev
```

You can also choose **Code → Download ZIP** on GitHub. That downloads source, not an APK or iPhone app.

## 2. Try it on both phones first

This is the shortest local test route, provided the installed Expo Go supports this project's Expo SDK 57. If Expo Go does not support that SDK, use a matching development build; do not change the SDK number without upgrading its dependencies together.

1. Install a compatible Expo Go on Android and iPhone.
2. Connect the computer and phone to the same trusted Wi-Fi.
3. Start `npm run dev` from the repository root. Keep the computer running.
4. Find the computer's local IPv4 address (`ipconfig` on Windows).
5. Copy `apps/mobile/.env.example` to `apps/mobile/.env`. Set `EXPO_PUBLIC_API_URL=http://YOUR-COMPUTER-IP:3000` with the actual address. Do not use localhost: on a phone it means the phone itself.
6. Run `npm run mobile` from the repository root. Scan the QR code with Expo Go on Android or the Camera app on iPhone. Allow camera/location only when you choose to test those features.
7. If the connection fails, check reachability/firewall rules for the private network. Restart Expo after changing its environment variables. A Metro tunnel does not automatically tunnel the separate port-3000 API.

In this development flow, the explicitly labeled synthetic Maadi location lets you test outside the fixture districts. Real GPS outside the supplied polygons is rejected. Switching **EN / العربية** changes interface language and saves the preference. Descriptions and notes remain in the language their author used.

## 3. Prepare a backend for an installed standalone app

An installed app bundles its JavaScript and no longer needs Metro, but it still needs a running Balaa API for sign-in, maps, photos and reports.

For an app that works away from your computer, host the Next.js application on a service supporting its Node server routes and configure `APP_MODE=supabase` as described in [SETUP.md](SETUP.md). Set up Supabase Auth, database migrations, private Storage and Edge Functions; execute the outstanding RLS/integration tests first. GitHub Pages cannot run this backend. Do not publicly expose the default JSON-backed demo with its open role chooser.

Set the reachable HTTPS backend URL as `EXPO_PUBLIC_API_URL` in the EAS **preview** environment. It is a public URL, not a secret. Never include service-role credentials in an `EXPO_PUBLIC_*` variable. The build config deliberately rejects missing, localhost, reserved `.invalid` and non-HTTPS endpoints for EAS builds.

## 4. Android: create an installable APK

You need an Expo account and a configured project. Run EAS commands from `apps/mobile`, while installing npm dependencies from the monorepo root:

```sh
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://YOUR-BALAA-BACKEND --visibility plaintext
npx eas-cli@latest build --platform android --profile preview
```

`eas init` associates the app with your Expo account and may write its project ID to the Expo config. Retain that actual project ID; no placeholder project is supplied. If asked, configure Android signing through your account. Confirm the application identifier is one you own before publishing to a store.

The supplied `preview` profile creates an **APK**. When the build succeeds, open its EAS install link on Android, download the APK and permit installation from that source if you trust it. An **AAB** is for Play distribution and is not directly installable this way. APK builds here have not been run or signed yet.

You may attach the APK to a GitHub Release so testers can download it. Keep signing keys and private configuration out of the repository and release attachments. Do not put your local `.balaa` report store in a release.

## 5. iPhone: internal build or TestFlight

An iPhone cannot install an Android APK. Normal iOS distribution requires Apple signing; EAS can perform cloud iOS builds even when your computer runs Windows.

For direct internal testing, use an Apple Developer Program account and register the test device before building:

```sh
cd apps/mobile
npx eas-cli@latest device:create
npx eas-cli@latest build --platform ios --profile preview
```

Open the registration link on the iPhone, finish the device registration/signing steps under your own account, and then install using the completed build's link. Ad hoc distribution is restricted to devices in the provisioning profile; a GitHub IPA download alone does not make it installable on every iPhone.

For wider beta testing, configure the EAS **production** environment's HTTPS API URL, create an App Store Connect record under an identifier you own, and use:

```sh
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios
```

Select the intended successful store build. Complete Apple's required app information and testing setup, then invite testers through TestFlight. External beta access may require Apple's review. These steps upload to your developer accounts and have not been performed for you.

## Current prototype limits

The original branding and both interface languages are included. The backend still uses synthetic geographic fixtures, mock identity and test-only delivery. Release mobile builds intentionally hide development gallery/synthetic-location tools. A standalone app outside the two fixture polygons cannot submit a real-GPS report until reviewed boundaries are configured. Live Supabase, native device behavior, EAS signing and store submission remain separate verification steps.

Official references, checked 26 September 2026:

- [GitHub: adding locally hosted code](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github)
- [Expo: first EAS build](https://docs.expo.dev/build/setup/)
- [Expo: Android APK builds](https://docs.expo.dev/build-reference/apk/)
- [Expo: internal Android and iOS distribution](https://docs.expo.dev/build/internal-distribution/)
- [Expo: TestFlight distribution](https://docs.expo.dev/submit/testflight/)
