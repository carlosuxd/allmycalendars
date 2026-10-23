# All My Calendars

A small desktop app (Windows + macOS) that shows the Google Calendars from all your Gmail accounts in one weekly view, with one-click **Join** for Meet, Zoom, Teams and Webex links.

- Sign in to as many Google accounts as you like (through your browser; the app never sees your password)
- Turn individual calendars on/off
- Give each account a label (e.g. "Work") and pick its dot color in ⚙ Settings → Manage accounts
- Weekly grid with all-day row, "now" line, and a "Next meeting" card with a Join button
- Event details: time, location, guests and RSVPs, description, meeting link
- The same meeting appearing in several of your accounts is shown once
- Refreshes every 5 minutes and when you switch back to the window; works offline with the last loaded data
- Meeting notifications 1–30 minutes before each meeting (set in ⚙ Settings); clicking one opens that meeting's details
- Lives in the system tray / menu bar: closing the window keeps reminders coming, and the tray shows your next meeting. Optionally starts when you log in.
- Settings view (⚙): **General** (Light / Dark / System theme, start at login, keep running in the tray), **Notifications**, and **Privacy**
- Resizes down to 420px wide: shows as many days as fit (today and tomorrow at the smallest size, the full week when there is room), with the sidebar behind a header button on small windows
- Read-only: it never changes your calendars

## 1. One-time Google Cloud setup (about 10 minutes)

Google requires every app that reads calendars to have its own "OAuth client". It's free.

1. Go to <https://console.cloud.google.com/> and sign in with **any one** of your Google accounts.
2. Top bar → project picker → **New project** → name it `All My Calendars` → Create. Make sure it's selected.
3. **APIs & Services → Library** → search **Google Calendar API** → **Enable**.
4. **APIs & Services → OAuth consent screen** (called **Google Auth Platform** in newer consoles):
   - App name: `All My Calendars`, support email: yours. Audience: **External**. Contact email: yours. Create.
   - **Data access → Add or remove scopes** → tick `.../auth/calendar.readonly` → Update → Save.
   - **Audience → Publish app** → confirm. This moves it to "In production".
     If you skip this, the app stays in "Testing" and Google will sign you out every 7 days.
     Personal-use apps don't need Google's verification.
5. **Clients** (or **Credentials → Create credentials → OAuth client ID**):
   - Application type: **Desktop app**, name: `All My Calendars desktop` → Create.
   - Copy the **Client ID** and **Client secret**.
6. In this folder, copy `.env.example` to `.env` and paste the two values:
   ```
   MAIN_VITE_GOOGLE_CLIENT_ID=1234-abc.apps.googleusercontent.com
   MAIN_VITE_GOOGLE_CLIENT_SECRET=GOCSPX-...
   ```

When you add an account, Google shows **"Google hasn't verified this app"**. That's expected for your own personal app: click **Advanced → Go to All My Calendars (unsafe)**, then make sure the **calendar** checkbox is ticked and click Continue.

## 2. Run it

Requires [Node.js](https://nodejs.org/) 20 or newer.

```bash
npm install
```

```bash
npm run dev
```

Click **Add Google account** on the welcome screen (later: **Manage** next to Accounts in the sidebar, or ⚙ → Manage accounts) and repeat for each of your accounts.

## 3. Build an installer

On Windows (creates `dist/All My Calendars Setup x.y.z.exe`):

```bash
npm run build:win
```

On a Mac (creates a `.dmg` in `dist/`):

```bash
npm run build:mac
```

The Mac version must be built on a Mac. The installers aren't code-signed, so on first launch Windows shows "Windows protected your PC" (click **More info → Run anyway**), and macOS asks you to right-click the app → **Open**.

The client ID from `.env` is built into the installer, so set it up before building.

### Updating the installed app (Windows)

Each `npm run build:win` bumps the version and creates a new `dist\All My Calendars Setup x.y.z.exe`. To update, just double-click it:
there's no wizard and no need to uninstall first. It closes the running app (including from the tray), replaces it with the new version, and reopens it.
Your accounts and settings are kept. You can delete older Setup files from `dist` whenever you like.

## Notifications

Open **⚙ Settings → Notifications** to turn reminders on/off, choose how early they arrive, and send a test notification. All-day events, meetings you declined, and calendars you've hidden don't notify.

Closing the window keeps the app running in the tray (Windows: the notification area by the clock, possibly under the **^** arrow; macOS: the menu bar) so reminders still arrive. To exit completely, use **Quit** in the tray menu.

**Not seeing notifications?**
- Windows: check that **Do not disturb** / Focus is off, and that All My Calendars is allowed under Settings → System → Notifications.
- macOS: the first time, allow notifications when asked, or later in System Settings → Notifications → All My Calendars.
- **Start when I log in** only works for the installed app, not `npm run dev`.

## Privacy: user privacy first

All My Calendars is built on one value: **user privacy first**. The same explanation is in the app under ⚙ Settings → Privacy.

- You sign in on Google's own page in your browser; the app never sees your password.
- It asks only for read-only calendar access (`calendar.readonly`) plus your email address to label each account. It can't change events or read Gmail, contacts or Drive.
- There is no All My Calendars server. Data goes directly from Google to your computer, and the app only connects to Google's sign-in and Calendar services.
- No analytics, telemetry or ads.
- Settings → Privacy can open your data folder, clear cached events, and link to your Google permissions page.

## Where things are stored

Your sign-ins (refresh tokens) are encrypted with the operating system's keychain (Windows DPAPI / macOS Keychain) in `data.json` inside the app's data folder:

- Windows: `%APPDATA%\All My Calendars`
- macOS: `~/Library/Application Support/All My Calendars`

Removing an account in the app deletes its token. To fully revoke access, also remove "All My Calendars" at <https://myaccount.google.com/permissions>.

## Project layout

- `src/main/`: Electron main process: Google sign-in (`auth.ts`), Calendar API (`google.ts`), local storage (`store.ts`), week loading and cache (`events.ts`), reminders (`notifier.ts`), tray menu (`tray.ts`)
- `src/preload/`: the safe bridge between the window and the main process
- `src/renderer/`: the React UI (`WeekView`, `EventDetails`, `Sidebar`)

## Credits

Designed and created by **[Carlos Collazos](https://www.instagram.com/ux.carlos)**, Senior Product Designer.

Icons by [Phosphor Icons](https://phosphoricons.com) (MIT license).
