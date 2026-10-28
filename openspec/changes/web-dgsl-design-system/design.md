# Design

## Context

See `proposal.md` for the motivation, and `openspec/brainstorms/2026-10-27-ntfy-jv-web-fork.md` (change 3) for the decisions taken with the owner.

Current state, after change `web-message-rendering` is archived:

- `web/` is React with plain JS/JSX, built by Vite 8 (`vite.config.js`) and linted by ESLint 9 flat config (`eslint.config.mjs`, `**/*.{js,jsx}` only). It has `jsconfig.json` and no TypeScript.
- 30 files import `@mui/material` (70 distinct exports) or `@emotion/*`, and 17 files import 42 distinct `@mui/icons-material` icons.
- The theme is decided before first paint by an inline script in `web/index.html` (lines 109-123). The script reads the `prefcache` localStorage blob written by `PrefCache.jsx` and toggles `html.dark`. `App.jsx:41-58` then builds an MUI theme and keeps `html.dark` in sync.
- RTL comes from `RTLCacheProvider.jsx` (Emotion cache plus `stylis-plugin-rtl`) and `document.dir = languageDir` (`App.jsx:47`).
- `/v1/version` is admin-only (`server.go:693`), so the web app cannot ask the server for its build.
- `Dockerfile-build` passes `VERSION`/`COMMIT` only to the Go build (`make VERSION=$VERSION COMMIT=$COMMIT cli-linux-server`). `make web-build` runs without them, and the Makefile computes `VERSION` with `git describe`, which has no `.git` in the build context.
- The DS source is `~/dgsl/design/ds/src`, at DS commit `21dfca27242e93446567f5aea7aea5a270697dcf` (2026-10-26). Re-read this at copy time and record the commit actually copied. It is TSX on Tailwind v4 CSS-first (`theme.css` imports `tailwindcss` first and is configured by the JS preset `tailwind-preset.ts`).

## Goals / Non-Goals

**Goals:**
- Every screen that remains is drawn with DS primitives, Tailwind utilities and `lucide-react` icons, and nothing from MUI or Emotion is left.
- The copied DS stays as close to the original as possible. Each local patch is listed in `web/src/ds/README.md`, so re-copying a newer DS is a file copy followed by re-applying the listed patches.
- The behaviour the Playwright suite checks is unchanged for every remaining feature.

**Non-Goals:**
- Other DS palettes (amber, olive, sapphire), reading presets, the DS print layout, and DS components the app does not use.
- Restyling `MarkdownContent.jsx` beyond swapping its Emotion container for Tailwind classes. Its rendering contract belongs to `web-message-rendering`.
- Topic groups (change `web-topic-groups`).
- Any Go/server change. The server still reports `enable_signup` and the other feature flags, and the web app ignores the flags for the deleted features.

## Decisions

### D1. Copy set (`web/src/ds/`, same relative layout as `design/ds/src`)

The list comes from the import graph of each primitive the app needs (each file's non-relative imports were checked).

| Group | Files copied |
|---|---|
| Styles | `theme.css`; `tokens/*.css` (every file except the six non-neutral theme files: `amber-*`, `olive-*`, `sapphire-*`); `tokens/theme/{neutral-light,neutral-dark,_base}.css`; `tailwind-preset.ts`; `tokens/types.ts`; `tokens/breakpoints.ts` |
| lib | `cn.ts`, `colorVariants.ts`, `colors.ts`, `link.tsx`, `portal-container.tsx`, `menuDialogFocus.ts` |
| hooks | `useMediaQuery.ts` |
| typography | `Text.tsx`, `Heading.tsx`, and a trimmed `index.ts` that exports only those two |
| layout | `Stack.tsx` |
| ui | `Button`, `Dialog`, `DialogActions`, `AlertDialog`, `Accordion` (a dependency of ResponsiveDialog), `Input`, `Label`, `Field`, `Select`, `ActionList`, `DropdownMenu`, `Popover`, `Tooltip`, `Checkbox`, `Switch`, `Card`, `Chip`, `Skeleton` (a dependency of Chip), `Badge`, `Avatar`, `Separator`, `Sheet`, `BottomSheet`, `Sonner` |
| interactive | `ResponsiveDialog/` |
| data-display | `ResponsiveTable/`, `EmptyState/` |

Tests, stories and barrel files of groups not copied are left out. A trimmed `ui/index.ts` exports only the copied primitives.

Kept as tokens even though the app does not use them: `tokens/domain.css` and `tokens/external-entities.css`. The generated neutral theme files reference their variables (`--court-*`), and copying them unchanged is cheaper than editing generated files.

Not copied: `blocks/`, `comments/`, `news/`, `notifications/`, `cards/`, `navigation/` (see D7), `layout/AppShell` and the other layout components, `ui/{Calendar,DatePicker,Command,ContextMenu,TreeView,Tabs,ScrollArea,ToggleGroup,Textarea,FloatingActionButton,DragHandle,StepProgress,VideoPlayer,Collapsible}`, `typography/{TextBrand,ChangeMark,RenderWordsWithMonospacedNumberedWords}`. `web-topic-groups` copies `Collapsible` or `Tabs` itself if its design needs them.

### D2. `@dgsl/*` and other dropped dependencies

- **`@dgsl/*`**: the only import inside the copy set's closure is `typography/RenderWordsWithMonospacedNumberedWords.tsx` (`DATE_LINE_REGEX` from `@dgsl/utils/judges`), and that file is not copied. **No `@dgsl/*` symbol needs inlining.** The remaining `@dgsl/*` references in the DS `dist/` come from cards, blocks and FolderGlyph, none of which are copied. The task verifies this with `grep -r "@dgsl/" web/src/ds` returning nothing.
- **`next-themes`**: used only by `ui/Sonner`. Patch: `Toaster` takes `theme` from its props (default `'system'`) instead of `useTheme()`. The app passes the active `'light' | 'dark'` (D5).
- **`react-window`**: used by `ui/ActionList` (the list under Select and DropdownMenu). The ntfy menus and selects hold fewer than 30 rows. Patch: a local `PlainList` in `ui/ActionList/PlainList.tsx` renders every row in a scrollable `div`, with the same props the call site passes (`listRef` exposing `element` and `scrollToRow`, `rowComponent`, `rowCount`, `rowHeight`, `rowProps`, ARIA props, `style.height`). `scrollToRow` becomes `scrollIntoView({ block: 'nearest' })` on the row element. Alternative considered: keep `react-window` (~6 KB). It was rejected because the brief removes it, and the patch is local to one file.
- **`@tailwindcss/container-queries`**: Tailwind v4 has container queries built in. Patch: remove it from the preset's `plugins`.
- **`@fontsource/*`**: not used. The fonts come from change `web-message-rendering` (self-hosted `woff2`).
- **`next`, `@blocknote/*`, `react-day-picker`, `date-fns`, `cmdk`**: nothing in the copy set imports them.

Added runtime dependencies: `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `sonner`, `tailwindcss-animate`. Pin each to the version in `design/ds/package.json`.

### D3. Tailwind v4 wiring

- Add `@tailwindcss/vite` to `vite.config.js` plugins, and add `tailwindcss` as a dev dependency.
- Make `web/src/index.css` the single stylesheet entry, imported by `index.jsx`, in this order:
  1. `@import 'tailwindcss';`
  2. `@config '../tailwind.config.ts';` (the config only does `presets: [dsPreset]`)
  3. `@import './ds/theme.css';`
  4. App-level overrides: `--font-ibm-plex-sans: 'IBM Plex Sans'` and `--font-recursive: 'JetBrains Mono NF'`, so that `--ds-font-mono` resolves to JetBrains Mono without editing the DS token file. The font family name must match the `@font-face` that `web-message-rendering` declares.
- Patch `theme.css`:
  - Drop the `@import` lines of the six non-neutral theme files.
  - Replace `@source './**/*.js'` with nothing. Tailwind v4's Vite plugin detects `web/src/**` automatically.
- Remove `public/static/css/fonts.css` usage only if `web-message-rendering` has not already replaced it.

### D4. TypeScript and lint

- Replace `jsconfig.json` with `tsconfig.json`: `allowJs: true`, `checkJs: false`, `strict: true`, `jsx: react-jsx`, `moduleResolution: Bundler`, `noEmit: true`, `include: ["src"]`. Strict applies to the TSX copy; JS files are not type-checked.
- Add the script `"typecheck": "tsc --noEmit"` to `web/package.json`. It must pass.
- ESLint: add `typescript-eslint` and a block for `**/*.{ts,tsx}` with its parser and recommended rules. Extend `import/resolver` extensions with `.ts` and `.tsx`. The DS copy keeps its own lint pragmas (`dgsl-ds-disable-next-line`), which ESLint treats as plain comments.
- Prettier formats the copy. The DS uses single quotes and the app uses double quotes, so add `web/src/ds/` to `.prettierignore` to keep the copy byte-identical to the source. A re-copy then diffs cleanly.

### D5. One theme mechanism

- `index.html` bootstrap script: in addition to toggling `html.dark`, it sets `data-theme="dark"` or `data-theme="light"` and the `theme-color` meta. It still reads `prefcache.theme`.
- `App.jsx`: compute `isDark` once from `prefs.theme()` and `prefers-color-scheme`, as today, through the DS `useMediaQuery`. One effect applies all four outputs:
  - `classList.toggle('dark')`
  - `dataset.theme`
  - the `<meta name="theme-color">` content (the DS top-bar surface colour of the active theme, read from the computed `--ds-color-bg-surface-1`)
  - Sonner's `theme` prop, through the `<Toaster>` mounted once in `App.jsx`
- The PWA manifest `theme_color` is served by the Go server (`server/types.go:488`) and is static. Changing it is out of scope, because the meta tag wins at runtime.

### D6. Removal of RTL

- Delete `RTLCacheProvider.jsx`, and remove `stylis` and `stylis-plugin-rtl`.
- `App.jsx` stops setting `document.dir` (stays `ltr`) and keeps setting `lang`. Language files are untouched.
- e2e: delete the "right-to-left language" test in `settings.spec.js`.

### D7. Navigation: hand-built from primitives, not `SidebarTree`

`Navigation.jsx` is rebuilt by hand with Tailwind, DS `Sheet` (the mobile drawer), `Badge` (unread count), `Tooltip`, `Separator` and plain `<a>`/`<button>` rows.

Reason: `navigation/SidebarTree` is built on `ui/TreeView`, an ARIA `tree` with expand/collapse and nested folder rows. The ntfy sidebar is a flat list of links (All notifications, each subscription, Settings, Account, Publish, Subscribe) with per-row badges and a muted icon, so tree semantics would be wrong for screen readers. Copying `SidebarTree` would also bring `TreeView` and `ScrollArea` for no gain. `AppShell` is DGSL-specific (brand, news card, resize handle) and is not copied either. Groups as collapsible sidebar sections, if change `web-topic-groups` chooses them, can add `ui/Collapsible` (31 lines) then.

### D8. MUI → DS mapping

Every export imported from `@mui/material` in `web/src` (checked by grep on 2026-10-27). A dash in "Where left" means every use is in a deleted file or section.

| MUI | Replacement | Where left after deletions |
|---|---|---|
| `ThemeProvider`, `createTheme`, `CssBaseline` | removed; tokens and `theme.css` base layer | App |
| `useTheme` | removed; `isDark` from the theme context of D5 where needed | ActionBar, Navigation, Preferences, PublishDialog, SubscribeDialog, SubscriptionPopup, Account |
| `useMediaQuery` | DS `hooks/useMediaQuery` (`(max-width: 767px)`) | App, Account, Preferences, PublishDialog, SubscribeDialog, SubscriptionPopup |
| `styled` (MUI and `@emotion/styled`) | Tailwind classes on plain elements | AvatarBox, EmojiPicker, Pref, styles.js (deleted, see below), MarkdownContent |
| `Box`, `Container`, `Stack` | `div` + Tailwind; DS `Stack` where a vertical gap list is clearer | many |
| `Typography` | DS `Text` / `Heading` | many |
| `Paper` | `div` with `bg-card` + elevation utility | Messaging |
| `AppBar`, `Toolbar` | `header` + Tailwind, sticky | ActionBar, App, Navigation |
| `Drawer` | DS `Sheet` (side `left`) below 768 px; static `aside` at 768 px and above | Navigation |
| `List`, `ListItemButton`, `ListItemIcon`, `ListItemText`, `ListSubheader` | `nav` > `a`/`button` rows + Tailwind | Navigation |
| `Divider` | DS `Separator` | ActionBar, Navigation |
| `Button` | DS `Button` | many |
| `IconButton` | DS `Button` icon-only variant with `aria-label` | many |
| `ButtonBase` | `button` + Tailwind | Notifications |
| `Link` | `a` with DS link classes | AttachmentIcon, ErrorBoundary, Navigation, Notifications, PublishDialog, Account |
| `TextField`, `InputAdornment`, `InputLabel` | DS `Field` + `Input` (adornments via the Input's slot props) | Login, Messaging, PublishDialog, SubscribeDialog, SubscriptionPopup, Preferences, Account, EmojiPicker |
| `Autocomplete` (other-server URL) | DS `Input` with `list` + `<datalist>` of previously used base URLs | SubscribeDialog |
| `Select`, `MenuItem` (as select options), `FormControl` | DS `Select` | Preferences, PublishDialog |
| `Menu`, `MenuItem` (as actions), `PopupMenu.jsx`, `Fade` (menu) | DS `DropdownMenu`; `PopupMenu.jsx` is deleted | ActionBar, SubscriptionPopup, Account (tokens menu) |
| `Checkbox`, `FormControlLabel`, `FormGroup` | DS `Checkbox` + `Label` | PublishDialog, SubscribeDialog |
| `Switch` | DS `Switch` + `Label` | SubscribeDialog |
| `Radio`, `RadioGroup` | — (only in the deleted phone-number dialog) | — |
| `Card`, `CardContent`, `CardActions`, `CardActionArea` | DS `Card`; actions row `flex overflow-x-auto` (spec: card actions scroll) | Notifications, Preferences, Account |
| `Chip` | DS `Chip` | PublishDialog, SubscriptionPopup, Account |
| `Badge` | DS `Badge` | Navigation |
| `Avatar` | DS `Avatar` | AvatarBox |
| `Tooltip` | DS `Tooltip` | Navigation, Notifications, Preferences, PublishDialog, Account |
| `Alert`, `AlertTitle` | `div role="alert"` with DS status tokens (`bg-warning-bg`, `text-warning-fg`, …) | Navigation, Preferences, Account |
| `Dialog`, `DialogTitle`, `DialogContent`, `DialogContentText`, `DialogActions`, `DialogFooter.jsx` | DS `ResponsiveDialog` (dialog ≥ 768 px, bottom sheet below) with `DialogActions`; `DialogFooter.jsx` rebuilt on `DialogActions` | PublishDialog, SubscribeDialog, SubscriptionPopup, Preferences, Account |
| `Modal` (image lightbox) | DS `Dialog` with a full-viewport content variant | Notifications |
| `Backdrop`, `CircularProgress` (page loader) | `div` overlay `bg-overlay` + `lucide-react` `Loader2` with `animate-spin` | App, Navigation, Notifications |
| `LinearProgress` (usage bars) | `div` track + fill with DS tokens and `role="progressbar"`, `aria-valuenow` | Account (Stats) |
| `Table`, `TableHead`, `TableBody`, `TableRow`, `TableCell` | DS `ResponsiveTable` | Account (tokens), Preferences (users) |
| `Snackbar` | `sonner` `toast()` through the DS `Toaster` | Messaging, Notifications, SubscriptionPopup, Account |
| `Popper`, `ClickAwayListener`, `Fade` (emoji) | DS `Popover` | EmojiPicker |
| `Portal` | removed; DS overlays portal by themselves | Messaging, Navigation, SubscriptionPopup, Account |

`web/src/components/styles.js` (MUI `styled` exports `Paragraph`, `VerticallyCenteredContainer`, `LightboxBackdrop`) is deleted. Each export becomes Tailwind classes at its call sites.

Icons: each `@mui/icons-material` icon maps to the `lucide-react` icon of the same meaning:

| MUI | lucide | MUI | lucide |
|---|---|---|---|
| Close, Clear | `X` | Notifications | `Bell` |
| Send | `Send` | NotificationsOff, NotificationsOffOutlined | `BellOff` |
| Edit | `Pencil` | MoreVert | `EllipsisVertical` |
| Check | `Check` | Menu | `Menu` |
| CheckCircleOutlineOutlined | `CircleCheck` | Logout | `LogOut` |
| WarningAmber | `TriangleAlert` | Person, AccountCircle | `User`, `CircleUser` |
| ErrorOutlineOutlined | `CircleAlert` | Settings | `Settings` |
| Info, InfoOutlined | `Info` | Refresh | `RefreshCw` |
| Visibility / VisibilityOff | `Eye` / `EyeOff` | Lock / LockOpen | `Lock` / `LockOpen` |
| Add | `Plus` | EnhancedEncryption | `LockKeyhole` |
| ContentCopy | `Copy` | RemoveCircle | `CircleMinus` |
| DeleteOutlineOutlined, DeleteForever | `Trash2` | ClearAll | `ListX` |
| PlayArrow | `Play` | KeyboardArrowUp | `ChevronUp` |
| InsertEmoticon | `Smile` | ChatBubble, ChatBubbleOutlineOutlined | `MessageSquare` |
| Article | `FileText` | Public | `Globe` |
| Star / StarBorder, Celebration | — (only in deleted billing and upgrade UI) | | |

### D9. Deleted screens and sections

- **Files deleted**: `UpgradeDialog.jsx`, `Signup.jsx`, `PasswordReset.jsx`, `PasswordResetRequest.jsx`, `EmailVerify.jsx`, `ReserveDialogs.jsx`, `ReserveIcons.jsx`, `ReserveTopicSelect.jsx`, `PopupMenu.jsx`, `styles.js`, `theme.js`, `RTLCacheProvider.jsx`.
- **Routes removed** from `App.jsx`: `signup`, `passwordResetRequest`, `passwordReset`, `emailVerify` (and their `routes.js` entries).
- **Sections removed**:
  - `Account.jsx`: the billing and upgrade parts of `AccountType`, `Emails`/`AddEmailDialog`, `PhoneNumbers`/`AddPhoneNumberDialog`, and the email, call and reservation rows of `Stats`. Phone numbers are removed too: this server has no Twilio settings, so `enable_calls` is false, and this is the same category of disabled feature as email.
  - `Preferences.jsx`: `Reservations`/`ReservationsTable`.
  - `Navigation.jsx`: `UpgradeBanner`.
  - `ActionBar.jsx`: the "Sign up" button.
  - `Login.jsx`: the "Sign up" and "Forgot password" links.
  - `SubscribeDialog.jsx`: the reserve checkbox and select.
  - `SubscriptionPopup.jsx`: the reservation menu items and `ReserveLimitChip`.
- **Kept**: `config.enable_login`/`require_login` handling, web push, the access-token UI and `VersionUpdateBanner`.
- **Unknown paths**: a removed path has no `<Route>`, so it gets the router's unmatched handling, as any unknown path does today.
- **Code paths left alone**: `AccountApi.js` methods for the deleted features (billing, email, phone, reservations) stay. They are non-UI and covered by unit tests, and deleting them buys nothing. Language keys stay.

### D10. Sourcemaps and build marker

- `vite.config.js`: `build.sourcemap: false`. `vite-plugin-pwa` (`injectManifest`) gets `sourcemap: false` for `sw.js` too, so no `sw.js.map` is emitted. The server's `staticRegex` still allows `sw.js.map`, which then returns 404.
- Build marker: `vite.config.js` `define` sets `__NTFY_BUILD_VERSION__` and `__NTFY_BUILD_COMMIT__` from `process.env.NTFY_BUILD_VERSION` and `process.env.NTFY_BUILD_COMMIT`, defaulting to `"dev"`. `Dockerfile-build` changes its web step to `RUN NTFY_BUILD_VERSION=$VERSION NTFY_BUILD_COMMIT=$COMMIT make web-build`, a one-line edit with a `# Fork:` comment. New names are used because `make` overrides `VERSION` with `git describe`. The `Preferences.jsx` footer prints both. No server API change is needed.

### D11. e2e

- Delete `reservations.spec.js`, the `signup` describe in `account.spec.js`, the "upgrade banner" describe in `navigation.spec.js`, and the RTL test in `settings.spec.js`.
- `fixtures.js`:
  - `signup()` is replaced by creating the user through the admin API client that already exists in `fixtures.js:43`, then logging in through `/login`.
  - `subscribe({ reserve })` loses the `reserve` option.
- `server.mjs` keeps `enable-signup` and `enable-reservations` on. A test asserts that the app shows no signup or reservation entry point while the server enables them (spec: "Server enables signup").
- MUI-specific selectors (class names, `MuiXxx` test ids) become role and label selectors. A test may not drop a behaviour assertion; a test removed for any reason other than the deleted features is a defect.

## Risks / Trade-offs

- [The DS copy drifts from the DS] → `web/src/ds/README.md` records the source commit and the patch list (Sonner theme prop, ActionList `PlainList`, preset plugins, `theme.css` imports and `@source`, trimmed barrels). Re-copying is manual and on request only.
- [ActionList is 864 lines and its keyboard logic assumes react-window's list API] → `PlainList` implements only the two members the component uses (`element`, `scrollToRow`). The Select and DropdownMenu keyboard paths are covered by e2e (the Settings selects and the subscription menu). If the patch exceeds one task's budget, keep `react-window` and record the deviation.
- [Tailwind preflight resets element styles that the Markdown rendering relied on (headings, lists, `pre`)] → `MarkdownContent.jsx` keeps an explicit class set for each rendered element. The `web-message-rendering` checklist is re-run on the migrated app.
- [Removing the signup route breaks the e2e users fixture] → task 2.4 rewrites the fixture before any screen work.
- [The DS sizes are fixed pixels and its base is 16 px; MUI's base is 14–16 px] → the owner approves every screen at phone and desktop width (task group 9). The ×0.8 card sizes from `web-message-rendering` are re-expressed against the DS scale, not stacked twice.
- [Bundle size: radix-ui + lucide, against MUI + Emotion removed] → lucide icons are imported one by one (tree-shaken). Record `vite build` sizes before and after (task 9.2). An increase is acceptable only if the owner accepts it.
- [The private DGSL code is still in the minified bundle] → accepted in the brief. Sourcemaps are off, so the source is not served.

## Migration Plan

1. The owner confirms that the remote is a private repository (task 1.1). Until then, nothing from `web/src/ds/` is committed or pushed.
2. Implement on `jvPalma/dev`. Each screen task leaves the app building and the e2e suite green.
3. Deploy through the `deploy-custom-image` runbook: build `ntfy-jv:<shortsha>`, edit `image:`, then `up -d --no-deps ntfy`.
4. The installed PWA picks up the new bundle on its next update check (`autoUpdate`). If it shows the old UI, reload; if that fails, clear the site data. Local Dexie data (subscriptions, notifications, prefs) is untouched, because there is no schema change.
5. Rollback: put the previous `ntfy-jv:<shortsha>` back in `image:`. Nothing is migrated, so rollback is lossless.

## Open Questions

- Exact `theme-color` value per theme (`--ds-color-bg-surface-1` or the header surface). This is visual only and is settled during task 3.2 with the owner.
