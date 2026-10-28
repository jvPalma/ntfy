# ntfy jv web fork: custom image, Android parity, DGSL design system

| Field | Value |
|---|---|
| Status | handed-off (`deploy-custom-image`, `web-message-rendering`, `web-dgsl-design-system`, `web-topic-groups`) |
| Date | 2026-10-27 |
| Proposed change ids | 1. `deploy-custom-image` · 2. `web-message-rendering` · 3. `web-dgsl-design-system` · 4. `web-topic-groups` (in this order) |

## Objective
Run the owner's own build of ntfy at `https://ntfy.jvpalma.com` instead of the official image. Bring its web app up to the features the owner already uses in the "ntfy jv" Android fork. Replace the web app's Material UI components with the DGSL design system components (neutral palette, light and dark), so the owner's ntfy looks and behaves like the other DGSL tools and the groups UI is built once, on the final components.

## Today
- **Production** runs the official image `binwiederhier/ntfy:v2.34.0`, container `jvpalma-ntfy` (`~/jvpalma-homelab/docker-compose.1102x.yml:243-267`), port 11028, data in `~/jvpalma-homelab/apps/ntfy/data`, env in `apps/ntfy/.env`. `data.bak-20261027` exists but has no `attachments/` and was likely copied while the container ran.
- Homelab publishers (`apps/ntfy/scripts/infra-health-check.sh`, `sonarr|radarr|lidarr-notify.sh`) send with `curl -s`, no retry, and address the container by name `jvpalma-ntfy`. The infra health check reports through ntfy itself.
- **This repo** (`jvPalma/ntfy`, branch `jvPalma/dev`, a PUBLIC GitHub fork) is upstream `main`, 5 commits after `v2.34.0` (`9f1d2ea4`): 7 Go files, no schema migration.
- **Build**: `Dockerfile-build` builds docs, web and Go in one image. `VERSION`/`COMMIT` default to `dev`/`unknown` (`Dockerfile-build:3-4,59`). `.dockerignore` excludes only `dist`, `*/node_modules`, `Dockerfile*`. The server embeds `web/build` (`server.go:155`) and serves `/static/*` without auth (`server.go:148,784`). Vite emits sourcemaps (`web/vite.config.js:10`).
- **Web app**: React + MUI 9 + Emotion, plain JS/JSX. 30 files import `@mui`/`@emotion`; 34 distinct MUI components; 17 files use `@mui/icons-material`. `theme.js` holds colours plus overrides (ListItemIcon min width, CardContent padding, CardActions `overflowX: auto`, dark Snackbar). RTL via `RTLCacheProvider.jsx` + `stylis`/`stylis-plugin-rtl`. Roboto self-hosted in `public/static/css/fonts.css`. Theme preference System/Light/Dark (`Prefs.js:3,34`, `App.jsx:41-43`). PWA precache excludes fonts (`vite.config.js:29`). Tests: vitest units in `web/src/app/*.test.js`, Playwright e2e in `web/e2e/*.spec.js` (~256 role/MUI selectors).
- **Data**: Dexie DB per logged-in user `ntfy-<username>` (`db.js:11`), `subscriptions: "&id,baseUrl,[baseUrl+mutedUntil]"` (only indexed columns declared), `prefs: "&key"`. Subscription id = topic URL (`SubscriptionManager.js:81`). Per-subscription attributes like `displayName` already live on the row (`SubscriptionManager.js:305-318`); account sync upserts and removes rows (`:109-138`). The subscription list already carries an unread count per subscription (`:15-20`).
- **Server features off** (`apps/ntfy/.env`): signup, payments, reservations, email.
- **DGSL design system** `@design/ds` (`~/dgsl/design/ds`, private DGSL monorepo): TSX + TypeScript, Tailwind v4 CSS-first (`theme.css` after `@import 'tailwindcss'`), Radix-based primitives in `src/ui/*`, layout (`AppShell`, `PageWithSidebar`), navigation (`SidebarTree`), `ui/Collapsible`. Neutral light/dark = generated `src/tokens/theme/neutral-{light,dark}.css`. Fonts IBM Plex Sans (same as Android) and Recursive (mono). Rules in `design/ds/DESIGN.md`.
- **DS dependencies**: `next` is a peer, unused by `dist/`. `next-themes` only in `ui/Sonner`. `@blocknote/*` only in `blocks/*`. `@dgsl/*` in 10 dist files. Primitives need `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `tailwindcss-animate`; `sonner` if toasts are copied.
- **Android fork** features: `HANDOFF-android-fork.md` §1–§5.
- **OpenSpec**: initialised 2026-10-27; no specs, changes or archive.

## Approach
Four changes, each deployable on its own.

1. **`deploy-custom-image`** (small, ~2 h). UI unchanged.
   - Build from a clean export of a commit (`git archive <sha>`, read-only), not from the dev working tree: `docker build -f Dockerfile-build --build-arg VERSION=<ver>-jv --build-arg COMMIT=<sha> -t ntfy-jv:<shortsha>`.
   - Compose: `image: ntfy-jv:<shortsha>`, keep `container_name: jvpalma-ntfy`, healthcheck, volumes and env as they are. Apply with `docker compose -f docker-compose.1102x.yml up -d --no-deps ntfy` (never `up --build` on the whole file: it rebuilds MinerU, ~25 GB).
   - Keep the last few `ntfy-jv:*` images. Rollback to a previous fork build or to `binwiederhier/ntfy:v2.34.0` is the same one-line `image:` edit.
   - Before each deploy: stop the container, copy `data/` including `attachments/`, start again; check upstream commits since the last deploy for schema migrations (rollback to upstream is only safe across releases without them).
2. **`web-message-rendering`** (handoff §1, §3, §4, §5; days, not weeks). Independent of MUI, so it ships before the DS work.
   - Fonts: self-host IBM Plex Sans and JetBrains Mono Nerd Font as subset `woff2` (Latin + the Nerd Font glyphs used, e.g. U+F018F), replace Roboto, add `woff2` to the PWA precache.
   - Markdown: GFM tables (`remark-gfm`) with horizontal scroll; syntax highlighting with Monokai Night in **both** themes, only the handoff's languages and aliases, lazy-loaded, skipped above a size cap; copy button per code block (focusable, labelled, "copied" state, error toast on failure, no card-click propagation, no re-wrap of the highlighted `<code>`). Keep `sanitizeUrl` on links and images; no raw HTML.
   - Card text ×0.8 (handoff §5 ratios) against the web base size; owner approves at phone width.
   - Chat order: newest at the bottom, open scrolled to the bottom, older messages load at the top without the viewport jumping, a new message always scrolls to the bottom (Android behaviour the owner approved).
   - Styles here use the current stack; change 3 rewrites them in Tailwind (~1 h, accepted).
3. **`web-dgsl-design-system`** (largest, 1.5–2 weeks after the cut below). **Blocked until the owner moves the code to a private repo.**
   - Package copy of the needed DS source into `web/src/ds/`, kept as **TSX**: add `typescript`, a `tsconfig.json` with `allowJs`, and TS support in ESLint. The rest of the app stays JS. `web/src/ds/README.md` records the DS commit copied from.
   - Copy only: tokens, neutral light/dark theme CSS, `lib/cn`, the primitives the app uses, and `SidebarTree`/`Collapsible` if `Navigation.jsx` is rebuilt on them (decide in design). Drop `next`, `next-themes` (Sonner follows the app's own theme switch), `@blocknote/*`, `@dgsl/*` (inline what is needed), `react-day-picker`, `date-fns`, `react-window`, `cmdk`.
   - Tailwind v4 via `@tailwindcss/vite`; DS mono token overridden to JetBrains Mono.
   - Replace every MUI component and icon (icons → `lucide-react`). The "use another server" Autocomplete becomes an `Input` + `<datalist>`. Mobile full-screen dialogs map to the DS `Sheet`/`ResponsiveDialog`. `CardActions` horizontal scroll is kept.
   - **Delete** the screens for features this server disables instead of porting them: `UpgradeDialog`, `Signup`, `PasswordReset*`, `EmailVerify`, `Reserve*`, the billing and email sections of `Account`.
   - Remove RTL (`RTLCacheProvider.jsx`, `stylis`, `stylis-plugin-rtl`); RTL languages render LTR.
   - Theme: keep System/Light/Dark; one mechanism sets `data-theme`/`dark` on `<html>`, also used by toasts and the PWA `theme_color`; no flash on cold start.
   - `sourcemap: false` in the fork so the DS source is not served from `/static`.
   - Show a build marker (version + commit) in the Settings footer.
   - Rule change: the handoff's "small, isolated fork" rule no longer applies to `web/` (hard fork). It still applies to Go/server code (`// Fork:` comments).
4. **`web-topic-groups`** (handoff §2, on the DS primitives).
   - Group name stored as an unindexed `group` field on the subscription row (no Dexie version bump; deleting the subscription clears it; reactive through `useLiveQuery`; harmless if rolled back to upstream). Group order and default tab in the `prefs` store. Groups are per device and per logged-in user.
   - Tab counts and the All tab's Unread/Read sections computed in memory from `subscriptions[].new`.
   - Rules: names trimmed; "All", "Ungrouped" and empty rejected; rename to an existing name rejected; the saved default tab falls back to All only after subscriptions have loaded; two open tabs stay in sync through the live query.
   - Desktop layout (tabs vs collapsible sidebar sections) decided in design.

## Who cares
The owner, the only user: Android/PWA and desktop browser at `ntfy.jvpalma.com`. Homelab services publish to it; the infra health alerts depend on it staying up.

## Success measures
- **1**: `jvpalma-ntfy` runs `ntfy-jv:<shortsha>` and is healthy; the startup log and `/v1/version` show the expected version and commit; a test message with a token arrives on the phone; existing users, tokens and topics work; rollback is a one-line edit.
- **2**: each item of handoff §1, §3, §4, §5 behaves as approved on Android (checklist); `npm test`, `npm run lint`, `npm run test:e2e` pass; the `vite build` output shows the highlighter in its own lazy chunk.
- **3**: `grep -rE "@mui|@emotion|stylis" web/src web/package.json` returns nothing; theme colours come only from the copied `neutral-{light,dark}.css`; `npm run build`, `npm test`, `npm run lint`, `npm run test:e2e` pass (e2e is the behaviour-parity gate, selectors updated, not tests dropped); no `.map` files under `/static`; the owner approves every remaining screen in light and dark at phone and desktop width.
- **4**: each item of handoff §2 behaves as approved on Android, plus the rules above.

## Scope
- **In**: custom image and compose swap; handoff §1–§5 on the web; DS package copy (neutral light/dark); full MUI/Emotion removal; deletion of screens for disabled features.
- **Out / follow-up**: server-side group sync between phone and web; DS on the Android app; other DS palettes; image registry; ntfy metrics in Prometheus/SigNoz; an out-of-band "ntfy is down" alert (today's alerts go through ntfy itself — accepted gap).
- **Non-goals**: CI/CD; keeping `web/` mergeable with upstream; RTL; the docs site (`docs/`).

## Landscape
| Kind | Item | Relation |
|---|---|---|
| Capability | none yet | ADDED: `fork-image-build` (1), `web-message-rendering` + `web-topic-view` (2), `web-ui-design-system` (3), `web-topic-groups` (4). Change 3 MODIFIES `web-message-rendering` styling only if a requirement mentions it |
| Active change | none | — |
| Code | `Dockerfile-build`, `Makefile` `web-build` | reuse; build args added at build time |
| Code | `~/jvpalma-homelab/docker-compose.1102x.yml:243-267` | `image:` → `ntfy-jv:<shortsha>` (task, outside this repo) |
| Code | `web/src/components/MarkdownContent.jsx`, `Notifications.jsx`, `public/static/css/fonts.css`, `vite.config.js` | change (2) |
| Code | 30 MUI files, `theme.js`, `styles.js`, `RTLCacheProvider.jsx` | replace / delete (3) |
| Code | `~/dgsl/design/ds/src/{tokens,ui,lib,navigation}` | copy subset into `web/src/ds/` (3) |
| Code | `web/src/app/SubscriptionManager.js`, `Prefs.js` | extend (4) |
| Code | `web/e2e/*.spec.js` | update selectors (2, 3, 4) |
| Doc | `HANDOFF-android-fork.md` | source of 2 and 4; its MUI pointers (`theme.js`, `styled`) and "apply the same rule" are superseded for `web/` |

## Risks & costs
- **Private DGSL code**: the repo is a public fork. The owner creates a private repo and switches the remote (git is the owner's domain) before change 3 is committed. Sourcemaps are disabled so the DS source is not served. The compiled, minified DS still ships to the browser — accepted.
- **Upstream sync**: after change 3, upstream web changes no longer merge; Go changes still do.
- **DS copy drift**: the copy does not follow later DS changes; README records the source commit; TSX kept so re-copying is a file copy.
- **Deploy window**: recreating the container drops in-flight `curl -s` alerts (seconds). A failed build leaves the running container untouched because the build happens before the `image:` edit.
- **PWA update**: `registerType: "autoUpdate"` swaps the UI under an open session on the next check; a stuck PWA is fixed by reloading or clearing site data.
- **Size**: change 3 touches ~20 files after deletions; tasks split by screen.

## Goldfish review
- Agents: opsx-zoom-out, opsx-spec-auditor, opsx-systems-analyst, opsx-behaviour-validator, opsx-problem-analyst · Findings: 0 critical / 28 important / 24 minor (before dedup)
- Defended: none contested.
- Fixed in this brief: sourcemaps leak the DS source; build identity (`VERSION`/`COMMIT`); clean build source and per-build tags with rollback to previous fork build; `--no-deps` deploy (MinerU); backup with container stopped and attachments; per-deploy migration check; fonts owned by one change, `woff2` subset and precached; Monokai in both themes; chat-order scroll contract; copy-button feedback and a11y; highlighter language subset, lazy load, size cap; `sanitizeUrl` kept; System/Light/Dark kept; `theme.js` overrides listed; `stylis` in the removal check; e2e as parity gate; groups on the subscription row with order/default in `prefs`; in-memory counts; group name rules and load pitfall; fork rule superseded for `web/`; Tailwind v4; capability for chat order; Autocomplete → `<datalist>`, `cmdk` dropped.
- Decided with the user: order Deploy → Markdown/chat → DS → Groups; DS copy stays TSX with TypeScript added; delete screens for disabled features; repo goes private before the DS copy; remove MUI entirely; JetBrains Mono NF as mono font; replace components, not only tokens.
- Assumed (owner may override): RTL dropped; Monokai in light theme too; always scroll to a new message; ×0.8 sizes approved at phone width.

## Open questions
- Change 3 design: rebuild `Navigation.jsx` on `SidebarTree`/`Collapsible` or by hand; full MUI → DS mapping table (Snackbar → Sonner, Drawer → Sheet, Grid/Box → Tailwind/`Stack`).
- Change 4 design: groups on desktop as tabs over the list, or as collapsible sidebar sections.
- Change 2: exact size cap for highlighting and the language list (start from the handoff's alias list).
