# Balaa shared backend (Google Apps Script)

The phone app on GitHub Pages sends every request to this script, so all phones share one set of reports. It runs the same reporting rules as the Next.js server (bundled from `apps/dashboard/src/server`) and stores everything in the Google account that deploys it:

| What                        | Where                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Reports, history, accounts  | `balaa-state.json` in the Drive folder **Balaa · بلاعة**                                                         |
| Photos                      | `photos/` in that folder, shared "anyone with the link can view" so the app can show them                        |
| Readable copy for the owner | Spreadsheet **Balaa · Reports**: tab البلاغات (reports) and tab الرسائل (لم تُرسل) (messages that were not sent) |
| District team code          | Script property `STAFF_CODE`                                                                                     |

No email is sent. Messages that would go to a district or a citizen are recorded with sender, recipient and subject, and listed in the admin's **Outgoing messages** tab and in the spreadsheet.

Citizen names and emails are stored in `balaa-state.json` (the owner's Drive). They are never returned to the public or to district staff; the admin outbox shows citizen addresses masked (`s***@example.com`).

## Deploy (one time, about 10 minutes)

1. Get the file: `apps-script/dist/Code.gs` (on GitHub: open it, then **Download raw file**). Rebuild it with `npm run build:apps-script` after changing the rules.
2. Open [script.google.com](https://script.google.com) signed in as the owner account, click **New project**, and name it `Balaa backend`.
3. Delete everything in `Code.gs`, paste the whole downloaded file, and click **Save**.
4. In the toolbar choose the function **setup**, then **Run**. Approve the permissions (Drive and Sheets for your own account). The log shows the new folder and spreadsheet links.
5. **Project Settings** (gear) → **Script properties** → **Add script property**: name `STAFF_CODE`, value a code of your choice for district staff. Share it only with the team.
6. **Deploy** → **New deployment** → type **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
     Click **Deploy** and copy the **Web app URL** (ends in `/exec`).
7. On GitHub: repository **Settings → Secrets and variables → Actions → Variables → New repository variable**: name `BALAA_BACKEND_URL`, value the web app URL. Then re-run the **Phone demo on GitHub Pages** workflow. The URL is a public address, not a secret.

"Anyone" is required so phones can reach it without a Google sign-in. The script still enforces the rules: only signed-in citizens can report, only staff with the team code can change a report, and citizens only see their own details.

## Updating the script later

Paste the new `dist/Code.gs`, save, then **Deploy** → **Manage deployments** → edit (pencil) → Version: **New version** → **Deploy**. The web app URL stays the same.

## Reset

Run **resetAllData** from the editor to empty the platform (reports, accounts, sessions and messages). Photo files stay in the `photos` folder until you delete them in Drive.

## Test locally without Google

```sh
npm run build:apps-script
node scripts/apps-script-emulator.mjs
```

Then build the phone app against it with `NEXT_PUBLIC_BALAA_BACKEND_URL=http://localhost:4174/exec npm run build:pages`. `tests/apps-script.test.ts` runs the same file against in-memory Google services in `npm test`.

## Limits

This is a pilot backend. Every request reads and writes one JSON file under a script lock, so requests are handled one at a time: fine for a pilot group, not for a city. Google's Apps Script quotas apply to the owner account. The Digital Egypt sign-in is a demonstration: it signs in anyone who taps it.
