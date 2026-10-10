# Real-time update patch

Base: `main` at `4a087f367eb65e35c5137566105c84576aeb36c9`.

## What updates live

- Admin Dashboard: selected-month transactions, daily revenue/commission, recent sales, pending GCash and top barbers; today's attendance and barber availability.
- Admin Transactions and Revenue Split: selected-range sales and payment/cancellation changes.
- Reports: selected-range transactions and expenses, with recalculation when filters or shop fixed-cost settings change.
- Barbers: selected-period earnings and admin staff directory changes.
- Expenses: expense additions, edits and deletions. The existing all-expenses screen still listens to its full expense history.
- Attendance: selected day's document, including missing/deleted documents and new active staff.
- Services menu and shop settings: shared listeners after login, cleaned up at logout. Staff-list listeners are admin-only.
- Barber Dashboard and Earnings: use the same role-scoped listener hook; Firestore queries force the signed-in barber's UID. Existing queue listeners remain in place.

## Safeguards and scope

- Screen listeners are active while the screen is focused. On returning, they reattach automatically. Identical transaction/expense/attendance queries share a backend listener.
- Queries apply date bounds on the server, not after fetching the newest 500 rows. The silent 500-record read/cache cap and original 1,000-row barber listener cap are removed.
- Slow fallback reads/manual refreshes cannot replace newer live snapshots or a changed date range.
- Empty cache-only snapshots are ignored; confirmed empty server snapshots clear the appropriate rows. Metadata-change delivery ensures a server confirmation is observed.
- Pending offline transactions are merged by ID; live data is persisted for the existing offline cache. Cross-device updates still require Firebase and connectivity; demo mode is local only.
- Relative Today/Week/Month filters roll forward at local midnight and on app resume/focus.
- Listener errors are exposed on the financial/attendance screens; pull-to-refresh retries screen listeners.
- Attendance and settings drafts are kept when remote changes arrive. A conflict asks the admin to discard/reload before saving. This is a UI safeguard, not atomic multi-admin conflict resolution.
- Service history is checked at delete time instead of attaching a full-history transaction listener merely to disable Delete.
- **GCash screenshots are still embedded in transaction documents.** Firestore delivers complete documents; date scoping and listener cleanup reduce reads but do not remove screenshot bandwidth. Broad report ranges and uncapped caches can be expensive/large. No receipt migration, aggregate backend, or billing guarantee is included.
- Existing write/offline-sync behavior is otherwise unchanged. Failed attendance/settings saves already have limitations in the original services; this patch does not redesign those writes.

## Apply

From a clean checkout of the base commit (or review conflicts if your `main` has advanced):

```sh
git switch -c feature/realtime-admin
git apply --check barbersync-realtime.patch
git apply barbersync-realtime.patch
npm ci
npm test
npm run typecheck
```

No new runtime dependencies. `npm test` uses Node's test runner and the existing TypeScript package.
The existing `barberId + createdAt` index covers the barber/date queries. Ensure the repository's Firestore rules and indexes are already deployed to the Firebase project. No rules/index changes are part of this patch.

Rebuild/install the app on every test phone using your existing build process. This patch does not modify a running installed APK by itself.

## Validation

Completed in the implementation workspace: 12/12 regression tests passed (also 12/12 with `TZ=Asia/Manila`), TypeScript `tsc --noEmit` passed, `git diff --check` passed, and an Expo web production export succeeded. No native build, emulator, deployed Firebase, or two-phone run was performed.

Automated tests use production TypeScript modules with mocked Firestore/native APIs. They cover role/date query scoping, more than 500 rows, shared-listener cleanup, payment filtering, remote updates/deletions, cache-only snapshots, pending offline rows, report recalculation, attendance reconciliation, shared-data role access, and hook stale-read/range guards.

These tests are **not** a Firebase emulator/security-rules test or a two-device Expo test.

### Two-device acceptance checklist

Use two admin accounts/devices (or the same allowed admin login on two phones) and a barber device:

1. Keep Dashboard/Transactions open on device A; record a cash sale on device B. Revenue, recent sale, commission and barber service counts should update without refreshing.
2. Record a GCash sale; inspect the receipt and cancel/verify an eligible transaction. Totals/status should change on the other device.
3. Keep Reports open. Add/edit/delete an expense elsewhere; verify expenses and net income. Change fixed costs; verify full-month report calculations.
4. Change attendance; verify dashboard counts and barber availability. While another admin has unsaved attendance notes/statuses, change that day remotely: their draft must remain and the reload conflict must appear.
5. Edit a service price/name, staff profile/active state, or shop settings. Verify menus, directory and derived settings on the other phone. Unsaved settings drafts must not be silently replaced.
6. Switch report ranges and tabs rapidly. Old-range results must not overwrite the new range. Reopen the app offline and confirm cached values; reconnect and confirm listeners resume.
7. Test at least 501 transactions in a selected historical period; verify complete counts/totals. Check an out-of-range sale does not affect that report.
8. Test midnight/background-resume rollover, logout/login as a different role, and Firebase permission/listener errors.

Watch Firebase usage during realistic GCash-heavy testing before rolling this out broadly.
