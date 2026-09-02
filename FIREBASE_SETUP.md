# Firebase setup — Bounce Pickleball

The app now uses **Firebase Authentication** (customer register / login / email
verification / password reset) and **Cloud Firestore** (the database for
members, bookings, vouchers, stamps, promos, courts, and settings).

Follow these steps once to connect your own Firebase project. No paid plan is
required — the free **Spark** plan covers Auth + Firestore and email
verification/reset links are sent by Firebase at no cost.

---

## 1. Create a Firebase project

1. Go to <https://console.firebase.google.com> and click **Add project**.
2. Name it (e.g. `bounce-pickleball`), accept the terms, and create it.
   (Google Analytics is optional — you can skip it.)

## 2. Enable Email/Password authentication

1. In the console: **Build → Authentication → Get started**.
2. Open the **Sign-in method** tab.
3. Enable **Email/Password** (leave "Email link / passwordless" off) and save.

That's all that's needed for the confirmation email — Firebase sends the
verification link and the password-reset link automatically. You can customise
the wording under **Authentication → Templates**.

## 3. Create the Firestore database

1. **Build → Firestore Database → Create database**.
2. Choose a location (e.g. `asia-southeast1` for Thailand).
3. Start in **production mode**. You'll publish the secure rules in **step 3a**
   below (after you've created an admin account), so for now you can leave the
   default rules — but the app can't seed or write until step 3a is done.

> **Seeding note:** demo data is loaded with `npm run seed` (needs
> `FIREBASE_SERVICE_ACCOUNT_PATH` in `.env`). To remove only those demo
> documents: `npm run unseed -- --yes`. Add `--courts` to also delete seed
> courts `c1`–`c3`. The app does **not** auto-seed on page load.

### 3a. Create an admin account, then publish these rules

Staff sign in to the admin panel with a **real Firebase account** that is listed
in an `admins` collection. Set that up first:

1. **Create the account** — Authentication → **Users** → **Add user** → enter
   the owner's email + a password. (Email verification isn't required for
   admins.)
2. **Copy its UID** — it appears in the Users table next to the account.
3. **Mark it as admin** — Firestore Database → **Start collection** (or add a
   document) → collection id `admins` → **Document ID = the UID you copied** →
   add any field (e.g. `role` = `owner`) → Save.
4. **Publish the rules.** They live in [`firestore.rules`](firestore.rules) —
   that file is the source of truth, not this document. Ship it with:

   ```bash
   npm run rules:deploy
   ```

   (Or paste the file into Firestore → Rules → Publish if you'd rather do it by
   hand.) For reference, this is what it enforces:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAdmin() {
      return request.auth != null
        && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }

    // a customer may edit their own profile fields only. stamps / bookingsYear
    // are loyalty currency and `suspended` is moderation state — both are
    // written by the server (Admin SDK) or staff, never by the account itself.
    function ownProfileEditOnly(uid) {
      return request.auth != null && request.auth.uid == uid
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
             'name', 'phone', 'email', 'lang', 'avatar', 'avatarUrl',
             'birthday', 'country', 'channel'
           ]);
    }

    function freshMember() {
      return request.resource.data.stamps == 0
        && request.resource.data.bookingsYear == 0
        && request.resource.data.suspended == false;
    }

    // staff registry — managed from the Firebase console only.
    // a signed-in user may read only their own entry (to check admin status).
    match /admins/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if false;
    }

    // public catalog — anyone can read; only admins can change
    match /courts/{id} { allow read: if true; allow write: if isAdmin(); }
    match /promos/{id} { allow read: if true; allow write: if isAdmin(); }

    // operational settings are public so the home grid works before login.
    // Bank/PromptPay details live on config/payout (signed-in only).
    match /config/settings { allow read: if true; allow write: if isAdmin(); }
    match /config/payout { allow read: if request.auth != null; allow write: if isAdmin(); }
    match /config/{id} { allow read, write: if isAdmin(); }

    // a customer may only read rows that belong to them. Queries must say so
    // (`where('userId', '==', uid)`) or Firestore rejects them outright.
    function ownRow() {
      return request.auth != null && resource.data.userId == request.auth.uid;
    }

    // members — sign-up creates its own doc with zeroed loyalty fields;
    // after that a customer can only touch profile fields, and can only read
    // their own: the collection holds names, phones, emails and birthdays.
    match /members/{uid} {
      allow read: if isAdmin() || (request.auth != null && request.auth.uid == uid);
      allow create: if (request.auth != null && request.auth.uid == uid && freshMember()) || isAdmin();
      allow update: if ownProfileEditOnly(uid) || isAdmin();
      allow delete: if isAdmin();
    }

    // money + loyalty — a customer reads only their own rows and writes none.
    // Bookings are created by `/api/bookings/pay` (Admin SDK, bypasses rules)
    // after the transfer slip is verified; staff write from the admin panel.
    // The booking grid gets other people's occupied slots from
    // `/api/slots/taken`, which returns court/date/hour and nothing else.
    match /bookings/{id} { allow read: if isAdmin() || ownRow(); allow write: if isAdmin(); }
    match /vouchers/{id} { allow read: if isAdmin() || ownRow(); allow write: if isAdmin(); }
    match /stampLog/{id} { allow read: if isAdmin() || ownRow(); allow write: if isAdmin(); }

    // verified slip payments — staff-readable audit trail, server-written only
    match /payments/{id} { allow read: if isAdmin(); allow write: if false; }

    // throttle counters for the paid slip-checking API — server eyes only,
    // or a customer could reset their own quota
    match /rateLimits/{id} { allow read, write: if false; }

    // admin activity log — staff only; it quotes member names, booking refs
    // and every slip that was opened
    match /adminLog/{id} { allow read: if isAdmin(); allow write: if isAdmin(); }
  }
}
```

Now the admin panel login (staff origin, locally `/admin`) accepts that email + password, and only
that account can edit courts, promos, settings, and other members. A customer's
browser can no longer create a booking, mark a voucher used, or move its own
stamp count — those writes only happen on the server.

Reads are scoped too: a customer sees only their own member, booking, voucher
and stamp rows, and cannot open the activity log at all. `src/store.jsx`
subscribes accordingly — scoped queries for customers, whole collections for
staff — so publishing these rules and running an old build would leave the
customer app with empty lists.

### 3b. Enable Storage, then publish its rules (payment slips)

There is **no Rules tab until a bucket exists**, so enable Storage first.

1. Firebase Console → left sidebar → **Build** → **Storage**.
2. Click **Get started**. Firebase asks two things:
   - *Start in production mode* (locked) — pick this; the rules below replace it
     anyway.
   - *Location* — **pick `us-central1`**, and note that it is permanent. Only
     `us-central1`, `us-east1` and `us-west1` sit inside Google's "Always
     Free" storage tier, and any of the three is equivalent in practice.
     Don't pick an Asian region: it bills from the first byte, and the upload
     runs from the Vercel function (region `iad1`, US) inside the checkout
     request — not from the customer's phone — so a US bucket is also the
     faster side of the trade. Staff in Thailand download a slip across the
     Pacific instead, which costs about half a second on a page they open
     rarely.
3. **The Blaze plan is required.** Since 3 Feb 2026 Cloud Storage is not part of
   the no-cost Spark plan: on Spark the **Get started** button asks you to
   upgrade, and API calls return `402`/`403`. Blaze is pay-as-you-go with a
   card on file, but the no-cost allowance (5 GB stored, 1 GB/day download)
   still applies, so slip storage stays free in practice. Set a budget alert
   in Google Cloud → Billing after upgrading.
4. Once the bucket is created the Storage page shows **Files | Rules | Usage**.
   Open **Rules**, replace everything with the block below, and click
   **Publish**:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

Deny-all is correct here, not a mistake: no browser ever touches the bucket.
Slips are written by `/api/bookings/pay` and read through the 5-minute signed
URL that `/api/admin/slip` mints for a signed-in admin — both use the Admin
SDK, which bypasses these rules.

5. Check the bucket name at the top of the **Files** tab (it looks like
   `gs://your-project.firebasestorage.app`, or `.appspot.com` on older
   projects) matches `VITE_FB_STORAGE_BUCKET` **without** the `gs://` prefix,
   in `.env` and in Vercel → Settings → Environment Variables. Firebase already
   put this value in the web config, so it is usually correct already.
6. Verify the whole path — bucket, upload, signed URL and the retention rule
   from the next section — without taking a real payment:

```
npm run check:storage
```

> **PDPA and bucket location:** there is no Thailand region for Cloud Storage,
> so wherever you put it the slips leave the country. That is allowed under
> PDPA s.28–29 when the recipient has adequate safeguards — Google Cloud's
> Data Processing Addendum plus Standard Contractual Clauses covers this, and
> it is what you would cite if asked. Record the choice in your privacy notice.

## 4. Register a Web App and copy the config

1. Project **Overview** (gear icon) → **Project settings**.
2. Under **Your apps**, click the **Web** icon (`</>`), register an app
   (nickname e.g. `bounce-web`), and **do not** enable Hosting yet.
3. Firebase shows a `firebaseConfig` object. Copy the values.

## 5. Fill in `.env`

Copy `.env.example` to `.env` (already created for you — just edit it) and
paste each value:

```
VITE_FB_API_KEY=AIza...
VITE_FB_AUTH_DOMAIN=bounce-pickleball.firebaseapp.com
VITE_FB_PROJECT_ID=bounce-pickleball
VITE_FB_STORAGE_BUCKET=bounce-pickleball.appspot.com
VITE_FB_MESSAGING_SENDER_ID=1234567890
VITE_FB_APP_ID=1:1234567890:web:abcdef...
```

`.env` is git-ignored, so your keys are not committed. (A Firebase web API key
is not a secret — it only identifies the project — but keeping it out of git is
still good hygiene.)

## 6. Authorise your dev domain

Under **Authentication → Settings → Authorized domains**, make sure
`localhost` is listed (it is by default). Add both production hosts when you
deploy:

- the customer site, e.g. `www.your-domain.com`
- the staff site, e.g. `admin.your-domain.com`

Staff login is a **separate origin**. Firebase Auth sessions do not cross
origins, which is the point: a customer cookie on the booking site cannot open
the staff panel.

### Staff origin (separate domain)

The customer app and the staff app are two HTML entries in one Vercel project.

**No custom domain (free `*.vercel.app`)** — leave `VITE_PUBLIC_ORIGIN` and
`VITE_ADMIN_ORIGIN` empty. Do not invent `admin.<project>.vercel.app`; that
host does not exist on the free plan.

| Site | URL |
|---|---|
| Customers | `https://<project>.vercel.app/` |
| Staff | `https://<project>.vercel.app/admin` |

Add `<project>.vercel.app` to Firebase **Authorized domains**, and restrict the
web API key to `https://<project>.vercel.app/*`. LINE Callback URL is
`https://<project>.vercel.app/auth/line/callback`.

**Custom domain later**

| Site | Local | Production |
|---|---|---|
| Customers | http://localhost:5173 | `VITE_PUBLIC_ORIGIN` (e.g. https://www.your-domain.com) |
| Staff | http://localhost:5173/admin | `VITE_ADMIN_ORIGIN` (e.g. https://admin.your-domain.com) |

The customer bundle never imports `src/admin/*`. Downloading the booking site
does not download the staff UI.

**Vercel**

1. Project → **Domains** → add `admin.your-domain.com` (same project as the
   customer domain). `vercel.json` already rewrites any `admin.*` host to
   `admin.html`. Until then, `/admin` on `*.vercel.app` serves the staff app.
2. Set Production env vars (Preview can omit them so `/admin` still works on
   `*.vercel.app`):

```
VITE_PUBLIC_ORIGIN=https://www.your-domain.com
VITE_ADMIN_ORIGIN=https://admin.your-domain.com
```

3. Redeploy. On the customer domain, `/admin` loads the customer app which
   immediately sends staff to `VITE_ADMIN_ORIGIN`. Preview deploys
   (`*.vercel.app`) still serve the staff app at `/admin` so you can test
   without a custom subdomain.

## 7. Restart the dev server

Vite only reads `.env` at startup:

```
npm run dev
```

The red "Firebase is not configured" banner disappears once the keys load.
Load demo courts/members/bookings with `npm run seed`. It only seeds when the
`courts` collection is empty. Remove that demo set with `npm run unseed -- --yes`.

## 8. Restrict your API key (do this before/at production)

The `VITE_FB_API_KEY` is a **client-side web key** — it ships inside the
browser bundle and is *meant* to be public (it only identifies the project;
real security is enforced by Firestore rules + Authorized domains). So it is
**not a secret**, and GitHub's secret scanner flagging it is a false positive.

That said, you should still lock it to your own domains so a copied key can't be
used from anywhere else. This is Firebase's own recommended production step:

1. Open Google Cloud credentials for the project:
   `https://console.cloud.google.com/apis/credentials?project=<your-project-id>`
2. Click the key named **"Browser key (auto created by Firebase)"**.
3. **Application restrictions → Websites** → add each origin that should work:
   - `http://localhost:5173/*` and `http://127.0.0.1:5173/*` (local dev)
   - `https://www.your-domain.com/*` (customer)
   - `https://admin.your-domain.com/*` (staff)
   - `https://<your-project>.vercel.app/*` (preview, optional)
   - `https://<your-project-id>.firebaseapp.com/*` and `https://<your-project-id>.web.app/*`
4. **API restrictions → Restrict key** → allow only: **Identity Toolkit API**,
   **Token Service API**, and **Cloud Firestore API**.
5. **Save.** A live key in git history is harmless once the key is restricted
   (or rotated). Do not rewrite git history for this.

> Never commit the built `dist/` folder — it inlines these values. `dist/` is
> git-ignored; Vercel builds from source using the env vars you set in its
> dashboard, so committed build output is both unnecessary and how keys leak.
>
> If you ever need the exposed key to be truly dead (not just restricted),
> create a new API key in the Credentials page, update it in `.env` **and**
> Vercel, delete the old key, and redeploy.

---

## How the customer flow works now

1. **Sign up** (Email) → Firebase creates the account, writes a `members`
   document, and emails a **verification link**. The user is signed out until
   they verify.
2. **User clicks the link** → email is verified.
3. **Log in** → unverified accounts are blocked with a clear message (and can
   resend the link from the "check your email" screen).
4. **Forgot password** → Firebase emails a **reset link**.

**LINE login** uses LINE Login (OAuth) → a small server endpoint
(`/api/auth/line`) that verifies the LINE code and returns a Firebase
**custom token**. The SPA then calls `signInWithCustomToken`.

### LINE Login setup

1. Create a **LINE Login** channel at
   <https://developers.line.biz/console/>.
2. Under **LINE Login → Callback URL**, add both:
   - `http://localhost:5173/auth/line/callback` (Vite dev)
   - `https://<your-production-domain>/auth/line/callback`
3. Copy **Channel ID** and **Channel secret** into `.env`:

```
VITE_LINE_CHANNEL_ID=1234567890
LINE_CHANNEL_SECRET=your_channel_secret
# Optional extra origins (comma-separated). localhost:5173–5175 and VERCEL_URL
# are always on the allowlist; the server ignores any other redirectUri.
# LINE_REDIRECT_ORIGINS=https://www.your-domain.com
```

4. Create a Firebase **service account** so the API can mint custom tokens:
   - Firebase Console → Project settings → **Service accounts**
   - **Generate new private key** → download the JSON file
   - **Local:** save as `service-account.json` in the project root (gitignored)
     and set `FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json` in `.env`
   - **Vercel:** paste the JSON as **one line** into
     `FIREBASE_SERVICE_ACCOUNT_JSON`, plus `VITE_LINE_CHANNEL_ID`,
     `LINE_CHANNEL_SECRET`, optional `LINE_REDIRECT_ORIGINS`, and the existing `VITE_FB_*` vars — then Redeploy

5. Restart `npm run dev` after editing `.env`.

### Test LINE Login on local first

1. In LINE Developers → Callback URL, include:
   `http://localhost:5173/auth/line/callback`
2. `npm run dev` → open **http://localhost:5173/** (same host you registered)
3. Open DevTools → Console (watch `[LINE]` logs)
4. Click **เข้าสู่ระบบด้วย LINE**, approve, then return to the callback page
5. On success you land on home signed in; on failure the callback page shows
   a detail line in dev mode — share that text if it still fails

Do not push until local login works.

> Never commit `LINE_CHANNEL_SECRET` or the service-account JSON. If a secret
> was pasted into chat or a ticket, rotate it in the LINE / Google Cloud
> consoles.

### SlipOK (PromptPay slip check)

A customer booking is created by one server endpoint,
`POST /api/bookings/pay`. The browser only sends *which* slots it wants plus
the slip photo; the server prices the cart from `courts`, verifies the slip
against that price with SlipOK, checks the receiver is the shop account, and
writes the bookings in a Firestore transaction. **Never** put `SLIPOK_API_KEY`
or `SLIPOK_BRANCH_ID` in Firestore or `VITE_*` vars.

Two guards protect the SlipOK bill and the shop's account:

- Each customer gets **8 failed** slip checks per hour, counted in
  `rateLimits`. Successful checks are never counted — real money arrived, so it
  isn't abuse.
- If neither `payAccountNo` nor `promptPayId` is set in **Admin → Settings**,
  checkout returns `notconfigured` instead of accepting the payment. There is
  nothing to compare a slip's receiver against, and silently skipping that
  comparison would let a slip paid to anyone at all buy a court.
- Those payout fields live in `config/payout`, readable only when signed in.
  `config/settings` stays public so the home grid can show the booking window
  before login, without publishing the shop bank account.

`POST /api/auth/line` is public (that is how OAuth works) and is throttled to
20 attempts per IP per hour. The `redirectUri` must match the server allowlist
— the body cannot point LINE at an attacker-controlled callback.

### Booking grid occupancy

Customers can only read their own bookings, so the grid asks
`POST /api/slots/taken` which court/hour pairs are gone on a given date. It
returns `courtId` and `hour` and nothing else — no `userId`, price, reference or
slip data — so one customer can see that 7pm is full without learning who took
it.

1. Create a SlipOK account and copy **API Key** + **Branch ID**.
2. Local `.env`:

```
SLIPOK_API_KEY=your_api_key
SLIPOK_BRANCH_ID=your_branch_id
```

3. Vercel → Project → Settings → Environment Variables → same two names,
   then Redeploy.
4. In **Admin → Settings**, save the shop **PromptPay ID** and **receiving
   account number**. Both are used twice: to draw the checkout QR, and to
   reject a slip whose receiver isn't the shop.

What the endpoint guarantees:

| Guard | How |
| --- | --- |
| No booking without payment | bookings are only written after SlipOK confirms the slip (or the total is ฿0 via a voucher) |
| Amount can't be faked | the amount sent to SlipOK is the server's cart total, and `data.amount` is re-checked afterwards |
| Slip can't be reused | `payments/{transRef}` is created in the same transaction, so a second attempt fails as "already used" |
| Wrong account rejected | the masked receiver from SlipOK must match `payAccountNo` / `promptPayId` |
| No self-serve staff booking | `payMethod` is derived on the server (`promptpay` / `voucher`), never taken from the request |
| Voucher must be yours | the voucher is loaded and checked for `userId == caller` and `used == false` inside the transaction |
| SlipOK credits can't be burned | 8 *failed* slip checks per customer per hour, counted in `rateLimits`; successful ones are never counted |
| No account configured, no payments | if `payAccountNo` and `promptPayId` are both blank the endpoint refuses to take money rather than skipping the receiver check |

If a slip verifies but the slot is lost in the race, the payment is stored as
`status: 'unapplied'` in `payments` (with the slip image) instead of
disappearing, and the customer is told to contact staff.

### Payment slips: storage, PDPA and retention

Verified slips are uploaded to Cloud Storage under
`slips/YYYY-MM/<transRef>.jpg`, in the bucket named by
`VITE_FB_STORAGE_BUCKET` (or `FIREBASE_STORAGE_BUCKET` if you want the server
to use a different one).

1. Create the bucket and publish the deny-all rules — **step 3b** above.
2. Set the 2-year retention so slips delete themselves. This lives in the
   Google Cloud console, not Firebase:
   `https://console.cloud.google.com/storage/browser?project=<your-project-id>`
   → click your bucket → **Lifecycle** tab → **Add a rule**:
   - Action: **Delete object**
   - Condition: **Age** = `730` days, and **Object name prefix** = `slips/`
   - Save. (Google evaluates lifecycle rules once a day, so a slip may live a
     few hours past day 730 — that is expected.)
3. Confirm with `npm run check:storage`, then redeploy.

How the data is handled:

- **Purpose limitation** — the image is kept only to prove a transfer and to
  settle disputes/accounting.
- **Access control** — the bucket denies every client read. Staff open a slip
  from **Admin → Bookings → ดูสลิป**, which calls `/api/admin/slip`; that
  endpoint checks the caller is in `admins` and returns a signed URL valid for
  **5 minutes**.
- **Accountability** — every slip view writes an `adminLog` entry with the
  admin's uid and the booking reference.
- **Retention** — each booking carries `slipExpiresAt` (payment date + 730
  days), the same window the lifecycle rule enforces. The admin dialog states
  the delete date and reminds staff not to download or forward the image.
- **Minimisation** — the app stores the slip photo, `transRef`, amount, sender
  name and receiving bank. No card data or full account numbers are stored.

### Testing that the guards actually hold

Rules and server checks are easy to break by accident, so both are covered by a
live test. It signs in as a throwaway customer with a real Firebase ID token and
tries the attacks against the real rules and the real handlers — nothing is
asserted from reading the source:

```
npm run dev                                              # in one terminal
npm run check:security -- --api=http://localhost:5173    # in another
```

Drop the `--api=` flag to test only the Firestore rules. The script writes
nothing outside ids starting with `sectest_` and deletes those plus its temp
auth users when it finishes. Run it after any change to `firestore.rules`, to
`api/_lib/bookingPay.js`, or to the checkout screen — and remember that
changing the rules file does nothing until `npm run rules:deploy` publishes it.

It covers four groups: writes a customer must not make, data a customer must
not read about anyone else, the checkout API, and the shop's payout config.

It also asserts the *inverse*, so over-tightening fails the test instead of
silently breaking the app: a customer must still edit their own profile,
register, read the court catalog and query their own bookings, vouchers and
stamps, and an account listed in `admins` must still read every collection the
admin panel depends on.

Three things it cannot prove without a real transfer, because they need SlipOK
to accept a genuine slip. Do these once by hand before launch:

1. Pay the exact amount → booking appears, and `payments/{transRef}` is created.
2. Upload the **same slip** again for another slot → rejected as already used.
3. Transfer to a different account and upload that slip → rejected.

If a customer exercises their right to erasure, delete the object at
`booking.slipPath` and clear `slipPath` on the booking + `payments/{transRef}`;
the booking row itself is accounting data and can stay.

**Admin panel** (staff origin / `/admin` locally) signs in with a real Firebase account that must be
listed in the `admins` collection (see step 3a). Only that account can edit
courts, promos, settings, and members under the secure rules.

## What's stored where

- **Firestore**: `members`, `bookings`, `vouchers`, `stampLog`, `payments`,
  `promos`, `courts`, `adminLog`, `admins`, and `config/settings`.
- **Cloud Storage**: `slips/YYYY-MM/<transRef>.jpg` — payment slip images,
  private, auto-deleted after 2 years.
- **Device-local (localStorage)**: language choice and in-app notification
  history — per-device UI state, not shared data.
