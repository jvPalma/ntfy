# Proposal

## Why

The ntfy web app at `ntfy.jvpalma.com` is built on Material UI and does not look like the owner's other DGSL tools. The topic-groups UI (change `web-topic-groups`) needs new tabs, menus and dialogs. Building them in MUI and rewriting them later would do the work twice. This change moves the whole web app to the DGSL design system (neutral palette, light and dark) first, so groups are built once on the final components.

Source: `openspec/brainstorms/2026-10-27-ntfy-jv-web-fork.md` (change 3 of 4).

## What Changes

- **Gate:** no part of this change is committed until the owner has moved the code to a private GitHub repository. `jvPalma/ntfy` is a public fork, and this change copies private DGSL source.
- Copy the needed `@design/ds` source into `web/src/ds/`, kept as TSX. Add TypeScript (`allowJs`) and TypeScript linting to `web/`. The rest of the app stays JS. `web/src/ds/README.md` records the DS commit copied from and every local patch.
- Add Tailwind v4 via `@tailwindcss/vite`, with the DS tokens and only the neutral light and dark themes. Override the DS mono font token to JetBrains Mono Nerd Font, which change `web-message-rendering` self-hosts.
- Replace every MUI and Emotion component and every `@mui/icons-material` icon with DS primitives, Tailwind and `lucide-react`. Remove `@mui/*`, `@emotion/*`, `stylis` and `stylis-plugin-rtl` from `web/package.json`.
- **BREAKING (fork-only):** delete the screens and entry points for features this server disables: signup, password reset, email verification, upgrade and billing, topic reservations, the account email and phone-number sections, and the upgrade banner. Remove their routes and e2e tests.
- **BREAKING:** remove right-to-left layout. RTL languages stay selectable and render left-to-right.
- Keep the System/Light/Dark theme preference. One mechanism applies the theme before first paint and drives the components, the toasts and the browser `theme-color`.
- Stop emitting and serving JavaScript sourcemaps.
- Show the build version and commit in the Settings page footer.
- The handoff's "small, isolated fork" rule no longer applies to `web/`, which becomes a hard fork. Go/server code keeps the rule.

## Dependencies

- Change `web-message-rendering` must be implemented and archived first. It self-hosts the fonts and rewrites `MarkdownContent.jsx` and the chat-order list; this change restyles the result with Tailwind. Its rendering behaviour (`web-message-rendering`, `web-topic-view`) must stay unchanged here.
- Change `web-topic-groups` depends on this change.

## Capabilities

### New Capabilities
- `web-ui-design-system`: what the web app looks like and offers: DGSL neutral light and dark themes, theme preference, the set of screens and entry points, layout direction, the build marker, and what the server exposes about the web bundle (no sourcemaps).

### Modified Capabilities
- None. No living spec exists yet. `web-message-rendering` and `web-topic-view` come from the previous change, and their behaviour does not change.

## Impact

- **Code:** about 30 files in `web/src/components/` rewritten. `theme.js`, `styles.js` and `RTLCacheProvider.jsx` deleted. Deleted files: `UpgradeDialog.jsx`, `Signup.jsx`, `PasswordReset.jsx`, `PasswordResetRequest.jsx`, `EmailVerify.jsx`, `ReserveDialogs.jsx`, `ReserveIcons.jsx`, `ReserveTopicSelect.jsx`. Changed: `App.jsx` (routes, theme), `index.html` (theme bootstrap), `PrefCache.jsx`, `vite.config.js`, `eslint.config.mjs`, `jsconfig.json` (replaced by `tsconfig.json`), and `public/static/langs` (untouched; unused keys stay).
- **New:** `web/src/ds/` (copied DS subset), `web/src/index.css` (Tailwind entry).
- **Dependencies:**
  - Removed: `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`, `@emotion/cache`, `stylis`, `stylis-plugin-rtl`.
  - Added: `tailwindcss`, `@tailwindcss/vite`, `tailwindcss-animate`, `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `sonner`, and (dev) `typescript`, `typescript-eslint`, `@testing-library/react`, `jsdom`.
  - Not added (removed from the DS copy): `next`, `next-themes`, `@blocknote/*`, `@dgsl/*`, `react-day-picker`, `date-fns`, `react-window`, `cmdk`, `@tailwindcss/container-queries`, `@fontsource/*`.
- **Tests:** e2e selectors updated in every remaining spec. `reservations.spec.js`, the signup tests, the upgrade-banner tests and the RTL test are deleted. Users for e2e are created through the admin API only.
- **Server:** none. The Go server still serves `app.html` and `/static`. Server-side feature flags are untouched. The web app ignores the flags for the deleted features.
- **Deploy:** ships through the `deploy-custom-image` runbook. Rollback goes to the previous `ntfy-jv:<shortsha>` image.
