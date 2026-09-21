# 💈 BarberSync — Mobile Barbershop Management System

BarberSync replaces the pen-and-paper process of a small barbershop (Chris Barber Shop).
It records every completed service, tracks Cash and GCash payments, automatically computes
the 50/50 shop-barber revenue split, manages the walk-in queue, and produces daily and
monthly financial reports that can be exported to PDF and CSV — even when the internet drops.

Built for **CCE106 – Application Development and Emerging Technologies**.

---

## 1. Features

| Area | What it does |
| --- | --- |
| Authentication | Email + password login with Firebase Auth, role detection (ADMIN / BARBER), protected routes, logout |
| Admin dashboard | Today's revenue, transactions, shop share, barber payout, cash vs GCash, pending GCash, queue count, monthly revenue, barber performance table, quick actions |
| Barber dashboard | Only the barber's own services, earnings, pay-period total and the live queue |
| Transactions | Fast entry: barber → service → amount → Cash/GCash → save. Automatic split, GCash reference + screenshot |
| Revenue split | Dedicated admin screen showing every transaction's shop/barber share plus daily totals |
| Queue | Walk-ins in arrival order, estimated wait time, Call / Start / Complete / Cancel |
| Services | Admin-managed menu with price, duration, active/inactive, minimum price rule (₱150 default) |
| Expenses | Rent, utilities, supplies, maintenance, other — used to compute net income |
| Reports | Daily / weekly / monthly / custom range, filter by payment method and barber, PDF + CSV export |
| GCash verification | Screenshot upload to Firebase Storage, admin verifies or rejects |
| Offline mode | Transactions saved to AsyncStorage when offline and auto-synced (no duplicates) when back online |
| Notifications | Local notifications for new transactions, pending GCash, sync completed, end-of-day summary |
| Settings | Shop details, revenue split %, minimum price, monthly fixed expense (₱24,000 default), notifications |
| Security | Role-based UI **and** Firestore/Storage security rules |

---

## 2. Technology stack

- React Native + **Expo** (managed workflow)
- **TypeScript** (strict mode)
- **Expo Router** for file-based navigation and role-based tab layouts
- **Firebase**: Authentication, Firestore, Storage
- **AsyncStorage** for offline data and caching
- **React Native Paper** for the UI components
- **expo-notifications** (local notifications; FCM-ready)
- **expo-print** (PDF) and a custom CSV generator
- **expo-image-picker** for GCash screenshots
- **@react-native-community/netinfo** for online/offline detection

---

## 3. Installation

```bash
npm install
npx expo install --fix   # aligns native package versions with your Expo SDK
cp .env.example .env     # then paste your Firebase keys
npx expo start
```

Then press `a` (Android emulator), `i` (iOS simulator) or scan the QR code with Expo Go.

> **Local mode:** if `.env` is empty the app still runs. It stores everything on the device
> and accepts only the demo accounts below. This is useful for a classroom demo.

---

## 4. Firebase setup

1. Go to <https://console.firebase.google.com> and create a project (e.g. `barbersync`).
2. **Add a Web app** (the `</>` icon). Copy the config values into `.env`:

   ```
   EXPO_PUBLIC_FIREBASE_API_KEY=AIza...
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=barbersync.firebaseapp.com
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=barbersync
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=barbersync.appspot.com
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
   EXPO_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:abcdef
   ```
3. **Authentication → Sign-in method → Email/Password → Enable.**
4. **Firestore Database → Create database** (production mode).
5. **Storage → Get started.** *(Optional — needs the Blaze plan; see the note below.)*
6. Publish the rules from `firestore.rules` and `storage.rules`
   (paste them into Console → Rules, or use the Firebase CLI):

   ```bash
   npm i -g firebase-tools
   firebase login
   firebase deploy --only firestore:rules,storage
   ```
7. Restart Expo with a cleared cache after editing `.env`: `npx expo start -c`.

### Creating accounts

For each user: **Authentication → Users → Add user** (email + password), then copy the
generated **UID** and create a matching document in Firestore:

`users/{UID}`

```json
{
  "name": "Juan Dela Cruz",
  "email": "barber@barbersync.test",
  "role": "BARBER",
  "phone": "09123456789",
  "active": true,
  "createdAt": "2026-09-19T05:00:00.000Z"
}
```

Use `"role": "ADMIN"` for the shop owner. **The role lives in Firestore, not in the app.**

---

## 5. Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@barbersync.test` | you choose it in Firebase (local mode: any 6+ characters) |
| Barber | `barber@barbersync.test` | you choose it in Firebase (local mode: any 6+ characters) |
| Barber 2 | `barber2@barbersync.test` | you choose it in Firebase (local mode: any 6+ characters) |

No password is hardcoded anywhere in the source code.

Demo content (services, transactions, queue, expenses) is seeded on first launch when
`EXPO_PUBLIC_DEMO_MODE=true`. Every demo record id starts with `DEMO_`, and
**Settings → Data & sync** has *Reload demo data* / *Clear demo data*.

---

### A note on Storage (Blaze plan)

Firebase now requires the **Blaze (pay-as-you-go)** plan to enable Cloud Storage on new
projects. If you skip Storage, **the app still works**:

- `uploadGcashScreenshot()` returns `null` and the error is caught.
- The screenshot stays on the device (`gcashScreenshotLocalUri`) and is still shown to the
  admin in the verification dialog.
- The GCash **reference number is still saved to Firestore**, so the paper trail is intact.
- Verify / Reject still behave normally.

The only thing you lose is screenshots syncing to other devices. Enable Storage later
(and deploy `storage.rules`) and uploads start working with no code changes.

## 6. Project structure

```
app/                      screens (Expo Router)
  _layout.tsx             providers, theme, demo seeding, notifications
  index.tsx               first-run routing by role
  (auth)/login.tsx
  (admin)/                dashboard, transactions, transaction-entry, revenue-split,
                          reports, queue, services, expenses, barbers, settings
  (barber)/               dashboard, transaction-entry, transactions, queue,
                          earnings, profile
components/
  ui/                     Screen, SectionCard, StatCard, StatusBadge, EmptyState,
                          LoadingState, ConnectionIndicator, AppSnackbar, RoleGuard
  dashboard/              BarberPerformanceTable, QuickActions
  transactions/           TransactionCard, TransactionEntryForm
  queue/                  QueueCard, QueueBoard
  reports/                ReportSummary
  services/               ServiceFormDialog
services/                 firebase, auth, transaction, queue, service, expense,
                          settings, report, notification, sync, storage, network,
                          localStore, demoData
context/                  AuthContext, AppDataContext
hooks/                    useAuth, useTransactions, useQueue, useReport
utils/                    calculations, dateUtils, validation, csvExport, pdfExport
types/                    auth, transaction, service, queue, expense, report
constants/                colors, config
firestore.rules           Firestore security rules
storage.rules             Storage security rules
```

---

## 7. Database structure (Firestore)

```
users/{userId}          id, name, email, role, phone, active, createdAt
services/{serviceId}    id, name, price, durationMinutes, active, createdAt
transactions/{txnId}    id, customerName, barberId, barberName, serviceId, serviceName,
                        amount, shopShare, barberShare, paymentMethod, gcashReference,
                        gcashScreenshotUrl, gcashVerified, status, createdAt, createdBy, synced
queue/{queueId}         id, customerName, serviceId, serviceName, barberId, barberName,
                        status, arrivalTime, estimatedWaitTime, startedAt, completedAt
expenses/{expenseId}    id, name, amount, category, date, notes, createdAt
settings/shop           shopName, shopAddress, shopContact, shopPercentage,
                        barberPercentage, minimumServicePrice, monthlyFixedExpense,
                        notificationsEnabled, endOfDaySummaryEnabled
```

Storage: `gcash-screenshots/{transactionId}.jpg`

---

## 8. How the money math works

```
shopShare   = amount × shopPercentage      (default 0.50)
barberShare = amount − shopShare           (default 0.50)
grossRevenue = Σ amount of COMPLETED transactions
netIncome    = grossRevenue − expenses
```

The barber payout is a **revenue split**, so it is reported separately and never
subtracted from net income twice. The split is stored on the transaction itself,
so changing the percentage later never rewrites history.

---

## 9. Offline mode

- Every screen reads from an AsyncStorage cache, so the app opens and works with no signal.
- A transaction created offline is stored in `@barbersync/pending-transactions` with `synced: false`.
- NetInfo detects the connection coming back and `syncPendingTransactions()` runs automatically.
- Each record keeps its locally generated id and is written with `setDoc(..., { merge: true })`,
  so **re-running the sync can never create a duplicate**.
- The header pill shows `Online`, `Offline`, `Syncing…` or `Synced`, plus the pending count.
  Tap it to force a sync.

---

## 10. Export

- **PDF** — Reports screen → *Export PDF*. Renders an HTML report with `expo-print`
  and opens the native share sheet.
- **CSV** — Reports or Transactions screen → *Export CSV*. Columns: Date, Customer, Barber,
  Service, Amount, Shop Share, Barber Share, Payment Method, GCash Reference, Status.

---

## 11. Notifications setup

Local notifications work immediately in a development build (and in Expo Go on Android).
For **remote push via Firebase Cloud Messaging** you still need to:

1. Create an EAS project and set `EXPO_PUBLIC_EAS_PROJECT_ID` in `.env`.
2. Add `google-services.json` (Android) and an APNs key (iOS) to the project / EAS credentials.
3. Build a development build: `npx expo install expo-dev-client && eas build --profile development`.
4. `getPushToken()` in `services/notificationService.ts` then returns the device token that
   your server or Cloud Function can push to.

Until then the app uses **local** notifications, which cover every in-app event
(new transaction, GCash pending, sync completed, end-of-day summary).

---

## 12. Testing checklist

- [ ] Admin login, barber login, invalid login, logout
- [ ] Barber is redirected away from admin routes
- [ ] Create a cash transaction → split is correct, dashboard updates
- [ ] Create a GCash transaction with reference + screenshot → status `PENDING_GCASH`
- [ ] Admin verifies the GCash payment → status `COMPLETED`
- [ ] Queue: add, call, start, complete, cancel; wait times recalculate
- [ ] Services: add, edit, deactivate; deletion blocked when history exists; minimum price enforced
- [ ] Expenses: add, edit, delete; net income changes in reports
- [ ] Reports: today / week / month / custom range; filter by payment method and barber
- [ ] Export PDF and CSV
- [ ] Turn on airplane mode → create a transaction → it is marked "Not synced"
- [ ] Turn the connection back on → it syncs automatically and appears exactly once
- [ ] Form validation messages for empty name, amount ≤ 0, missing GCash reference

---

## 13. Troubleshooting

| Problem | Fix |
| --- | --- |
| "Local mode" banner on the login screen | `.env` is missing or empty; add the Firebase keys and restart with `npx expo start -c` |
| `auth/invalid-credential` | Wrong email/password, or the user has no `users/{uid}` document |
| "Your account has no profile record yet" | Create the Firestore `users/{uid}` document with a `role` |
| `Missing or insufficient permissions` | Deploy `firestore.rules` and make sure the user's profile has the right role |
| Icons are missing | `npx expo install react-native-vector-icons @expo/vector-icons` |
| Env changes are ignored | Expo caches env vars; restart with `npx expo start -c` |
| Notifications do nothing in Expo Go | Expo Go (SDK 53+) removed the notifications module. The app detects this and disables them instead of crashing. Use a development build (`npx expo run:android`) to enable them |

---

## 14. Known limitations

- Cloud Storage for GCash screenshots requires the Blaze billing plan. Without it, screenshots are stored and displayed on the device only; the reference number is still saved to Firestore.
- Notifications are automatically disabled inside Expo Go (SDK 53+ removed the module). Everything else works; use a development build to demo them.
- Remote push notifications (FCM) need EAS credentials — the service layer is ready, the credentials are not included.
- Firebase Auth uses in-memory persistence plus our own AsyncStorage profile cache; the app restores your session but Firebase itself may ask for a fresh login after a long time offline.
- The customer-facing role is out of scope; only Admin and Barber are implemented.
- Reports load up to the latest 500 transactions per query, which is more than enough for a small shop.
