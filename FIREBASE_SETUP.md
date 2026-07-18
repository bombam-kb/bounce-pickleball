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
3. Start in **production mode**, then paste the rules below under the **Rules**
   tab and **Publish**. These let signed-in users manage their own data and
   read shared catalog data (courts/promos). Tighten further for real
   production, but this is a safe starting point:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // shared catalog — anyone signed in can read; writes are admin-only
    // (do admin writes from a trusted environment or lock these to a claim)
    match /courts/{id}    { allow read: if true;  allow write: if request.auth != null; }
    match /promos/{id}    { allow read: if true;  allow write: if request.auth != null; }
    match /config/{id}    { allow read: if true;  allow write: if request.auth != null; }

    // members: a user can read/write only their own member doc
    match /members/{uid} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null && request.auth.uid == uid;
    }

    // bookings / vouchers / stamps: readable & writable by signed-in users
    match /bookings/{id}  { allow read, write: if request.auth != null; }
    match /vouchers/{id}  { allow read, write: if request.auth != null; }
    match /stampLog/{id}  { allow read, write: if request.auth != null; }
    match /adminLog/{id}  { allow read, write: if request.auth != null; }
  }
}
```

> ⚠️ These rules are intentionally permissive to keep the demo working
> client-side. For a real launch, move admin writes (courts, promos, other
> members, adminLog) behind a custom claim or a backend, and scope
> bookings/vouchers to their owner.

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
`localhost` is listed (it is by default). Add your production domain when you
deploy.

## 7. Restart the dev server

Vite only reads `.env` at startup:

```
npm run dev
```

The red "Firebase is not configured" banner disappears once the keys load. On
first run the app **auto-seeds** the demo dataset (3 courts, sample members,
bookings, promos, vouchers, and settings) into Firestore. It only seeds when
the `courts` collection is empty, so it won't duplicate on later runs.

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
   - `localhost` and `127.0.0.1` (local dev)
   - your production domain, e.g. `your-project.vercel.app`
   - `<your-project-id>.firebaseapp.com` and `<your-project-id>.web.app`
4. **API restrictions → Restrict key** → allow only: **Identity Toolkit API**,
   **Token Service API**, and **Cloud Firestore API**.
5. **Save.**

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

**LINE login** remains a demo shortcut (Firebase has no native LINE provider);
it signs into the sample member without real authentication. To make LINE real
you'd add a LINE Login → Firebase custom-token exchange via a small backend.

## What's stored where

- **Firestore**: `members`, `bookings`, `vouchers`, `stampLog`, `promos`,
  `courts`, `adminLog`, and `config/settings`.
- **Device-local (localStorage)**: language choice, the admin-panel unlock, and
  in-app notification history — these are per-device UI state, not shared data.
