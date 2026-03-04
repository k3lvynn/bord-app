# Testing Session Persistence (Sign-Out After Updates)

## The Bug
After a TestFlight binary update, `INITIAL_SESSION` fires before AsyncStorage
finishes reading the stored token, returning null. `resolveAuth(null)` runs,
user sees the sign-in screen. Then `SIGNED_IN` fires with real user but
`initializedRef` is already true so the redirect never fires.

## What the v47 Fix Does
`getSession()` explicitly awaits AsyncStorage — it's reliable even after binary
updates. We race it against `INITIAL_SESSION`. Whoever resolves first wins.
`initializedRef` guards prevent double-execution.

---

## How to Reproduce the Bug (v46 baseline)

**Option A — TestFlight (real-world)**
1. Install v46 from TestFlight, sign in, stay signed in
2. Submit v46.1 (bump build number only, no code change)
3. Install update from TestFlight
4. Open app → lands on sign-in screen instead of home = bug confirmed ✓

**Option B — Simulate locally with Xcode (faster)**
1. Sign in on a dev build on physical device
2. Cmd+Shift+K (Clean Build Folder) in Xcode
3. Re-run with Cmd+R — fresh binary, existing AsyncStorage
4. If you hit sign-in screen = bug reproduced ✓

**Option C — Force AsyncStorage delay in code (unit-level)**
In lib/auth.tsx (temporarily), add:
```ts
// TEMP TEST ONLY — remove before shipping
const authStorage = {
  getItem: async (key: string) => {
    await new Promise(r => setTimeout(r, 3000)); // simulate slow read
    return AsyncStorage.getItem(key);
  },
  ...
};
```
Then observe: v46 shows sign-in screen, v47 waits and auto-signs in.

---

## How to Verify the v47 Fix Works

1. Build v47 development client: `eas build --profile development`
2. Install on device, sign in
3. Build v47 production: `eas build --profile production --platform ios`
4. Distribute via TestFlight internal track
5. Install over existing dev build
6. Open app → should land on home screen ✓

## What to Look For in Logs
Add this temporarily to lib/auth.tsx resolveAuth:
```ts
const resolveAuth = (u: User | null) => {
  console.log('[Auth] resolveAuth called, source: getSession vs INITIAL_SESSION', !!u);
  ...
};
```
In v47 you should see "resolveAuth called" once. In v46 you'd see it called
twice — once with null (INITIAL_SESSION too fast), once with user (SIGNED_IN
ignored due to initializedRef).

