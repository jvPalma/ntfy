# Tasks

Prerequisite: change `web-message-rendering` is archived. Every group leaves `npm run build`, `npm test`, `npm run lint`, `npm run typecheck` (from 2.2 on) and `npm run test:e2e` passing for the screens it touches. Run the commands in `web/`.

## 1. Gate

- [ ] 1.1 Owner confirms that the code now lives in a private GitHub repository and `origin` points to it. Verify by checking that `git remote -v` and `gh repo view --json visibility` show `PRIVATE`. The owner runs or approves this; the agent never changes remotes. No later task starts before this one is ticked.

## 2. Tooling and DS copy

- [ ] 2.1 Add `tailwindcss`, `@tailwindcss/vite`, `typescript`, `typescript-eslint`, `@testing-library/react` and `jsdom` (dev), and `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `sonner` and `tailwindcss-animate` (runtime), pinned to the versions in `~/dgsl/design/ds/package.json`. Verify with `npm ci` succeeding and `package-lock.json` updated.
- [ ] 2.2 Replace `jsconfig.json` with `tsconfig.json` (D4), add the `typecheck` script, add the `**/*.{ts,tsx}` ESLint block and the `.ts`/`.tsx` resolver extensions, and add `src/ds/` to `.prettierignore`. Verify with `npm run typecheck` and `npm run lint` passing on the unchanged app.
- [ ] 2.3 Copy the D1 file set from `~/dgsl/design/ds/src` into `web/src/ds/` (read-only on the source). Apply the D2/D3 patches: Sonner `theme` prop, ActionList `PlainList`, preset plugins without container-queries, `theme.css` with only the neutral imports and no `@source './**/*.js'`, and trimmed `ui/index.ts`/`typography/index.ts`. Write `web/src/ds/README.md` with the source commit (`git -C ~/dgsl log -1 --format=%H -- design/ds`) and the patch list. Verify that `grep -rE "@dgsl/|next-themes|react-window|@blocknote|date-fns|cmdk|from 'next" web/src/ds` returns nothing and `npm run typecheck` passes.
- [ ] 2.4 Wire Tailwind: add `@tailwindcss/vite` to `vite.config.js`, create `tailwind.config.ts` (`presets: [dsPreset]`) and `src/index.css` (D3 order, font variable overrides), and import it in `index.jsx`. Verify that `npm run build` succeeds and the built CSS contains `--ds-color-bg-base` for `[data-theme='light']` and `[data-theme='dark']`, and no `amber`/`olive`/`sapphire` theme selectors.
- [ ] 2.5 Add a unit test `src/ds/__tests__/copy.test.jsx` with the per-file `// @vitest-environment jsdom` pragma (the suite default stays `node`) that renders `Button`, `Dialog` (open), `Select` (open, 3 options, arrow-key navigation) and `DropdownMenu` (open, Enter on an item calls `onSelect`) with Testing Library. Verify that `npm test` passes; this guards the `PlainList` patch.

## 3. Theme, toasts, RTL and app shell

- [ ] 3.1 Remove `ThemeProvider`, `createTheme`, `CssBaseline`, `RTLCacheProvider.jsx`, `theme.js` and `document.dir` handling from `App.jsx`, and remove `stylis` and `stylis-plugin-rtl`. Verify that the app renders with `<html dir="ltr">` after choosing Arabic in Settings (manual), and delete the RTL e2e test in `settings.spec.js`.
- [ ] 3.2 Implement D5: the `index.html` bootstrap sets `dark`, `data-theme` and `theme-color`; `App.jsx` applies all four outputs from one `isDark`; mount the DS `<Toaster theme=…>` once. Verify with the e2e "theme" test extended to assert `data-theme` and the `dark` class for Light, Dark and System (with `page.emulateMedia({ colorScheme })`), and by reloading with the Dark preference and seeing no light frame (manual, throttled CPU).
- [ ] 3.3 Rebuild the `App.jsx` layout (`Layout`, `AuthLayout`, `Loader`) on Tailwind: page loader with `Loader2`, main content area, no `Backdrop`/`CircularProgress`. Delete `styles.js` and inline its three exports at their call sites. Verify that `npm run test:e2e -- navigation.spec.js` passes.
- [ ] 3.4 Rebuild `ActionBar.jsx` on a sticky `header`, DS `Button` (icon-only with `aria-label`) and DS `DropdownMenu`. Remove the Sign up button. Delete `PopupMenu.jsx` once its last importer (`SubscriptionPopup.jsx`, task 6.1) is migrated, and leave it until then. Verify with the e2e tests that open the account menu and log out.

## 4. Delete disabled-feature screens

- [ ] 4.1 Rewrite `e2e/fixtures.js`: `signup()` creates the user with the admin API client and logs in through `/login`, and `subscribe()` drops `reserve`. Delete `reservations.spec.js`, the `signup` describe in `account.spec.js` and the "upgrade banner" describe in `navigation.spec.js`. Verify that `npm run test:e2e` passes before any further deletion.
- [ ] 4.2 Delete `Signup.jsx`, `PasswordReset.jsx`, `PasswordResetRequest.jsx` and `EmailVerify.jsx`, and their routes in `App.jsx` and `routes.js`. Remove the Sign up and Forgot password links from `Login.jsx`. Add the e2e test "no signup entry point while the server enables signup" (top bar and login page). Verify that it passes and that `/signup` shows no form.
- [ ] 4.3 Delete `UpgradeDialog.jsx`, `ReserveDialogs.jsx`, `ReserveIcons.jsx` and `ReserveTopicSelect.jsx`. Remove `UpgradeBanner`, the reservation UI in `SubscribeDialog.jsx` and `SubscriptionPopup.jsx` (including `ReserveLimitChip`), `Reservations`/`ReservationsTable` in `Preferences.jsx`, and in `Account.jsx` the billing/upgrade parts of `AccountType`, `Emails`/`AddEmailDialog`, `PhoneNumbers`/`AddPhoneNumberDialog` and the email/call/reservation rows of `Stats`. Add the e2e test "no reservation controls while the server enables reservations". Verify that `npm run build` and `npm run test:e2e` pass and that `grep -rn "Reserve\|Upgrade\|enable_payments\|enable_emails\|enable_calls\|enable_reservations" web/src/components` returns nothing.

## 5. Login and Navigation

- [ ] 5.1 Rebuild `Login.jsx` on DS `Field` + `Input` (password visibility toggle as an icon-only `Button` with `aria-label`), DS `Button` and `Text`. Verify that `account.spec.js` "wrong password is rejected" and the login flows pass.
- [ ] 5.2 Rebuild `Navigation.jsx` by hand (D7): a static `aside` at ≥ 768 px and a DS `Sheet` (left) below; nav rows as links with `aria-current`; DS `Badge` for unread counts; `BellOff` for muted subscriptions; `Separator`; the alerts (notification permission, iOS install, browser/context not supported, version update) as `role="alert"` blocks with DS status tokens. Verify that `navigation.spec.js` passes, and at 360 px the menu button opens the sheet and choosing a topic closes it (e2e).
- [ ] 5.3 Rebuild `AvatarBox.jsx` on DS `Avatar` and `AttachmentIcon.jsx` on Tailwind. Verify that a notification with an attachment and an icon renders both (existing `notifications.spec.js` cases pass).

## 6. Topic view and messages

- [ ] 6.1 Rebuild `SubscriptionPopup.jsx` on DS `DropdownMenu`, and its dialogs (display name, clear, unsubscribe) on DS `ResponsiveDialog` + `DialogActions`. Replace `Snackbar` with `toast()`. Delete `PopupMenu.jsx`. Verify that the subscription menu e2e cases pass (mute, clear, unsubscribe, rename).
- [ ] 6.2 Rebuild `Notifications.jsx`: notification cards on DS `Card` with the actions row `flex overflow-x-auto`; DS `Tooltip`, `Button`, `Chip`; the image lightbox on DS `Dialog`; copy and clear feedback through `toast()`; the empty and loading states with `Loader2`. Keep the `web-message-rendering` chat order and scroll contract unchanged. Add the e2e test "card actions scroll horizontally at 360 px" (a message with 3 long actions, row `scrollWidth > clientWidth`, card not overflowing). Verify that `notifications.spec.js` and the new test pass.
- [ ] 6.3 Replace the Emotion container in `MarkdownContent.jsx` with Tailwind classes for every element it renders (headings, lists, links, `pre`, `code`, tables, blockquote, images). Re-run the `web-message-rendering` checklist (tables, Monokai Night in both themes, copy button, ×0.8 sizes re-expressed on the DS scale) and verify every item manually in light and dark.
- [ ] 6.4 Rebuild `Messaging.jsx` (the bottom publish bar) on Tailwind + DS `Input` + icon-only `Button`, with `toast()` for errors. Verify that `publish.spec.js` quick-publish cases pass.

## 7. Dialogs

- [ ] 7.1 Rebuild `SubscribeDialog.jsx` on DS `ResponsiveDialog`, `Field`/`Input`, `Checkbox`, `Switch` and `Label`. Replace the other-server `Autocomplete` with `Input` + `<datalist>` of the previously used base URLs. Rebuild `DialogFooter.jsx` on DS `DialogActions`. Verify that `subscribe.spec.js` passes, including subscribing to another server by typing a URL that is not in the list.
- [ ] 7.2 Rebuild `PublishDialog.jsx` on DS `ResponsiveDialog`, `Field`/`Input`, `Select`, `Checkbox`, `Chip` and `Tooltip`, with the attachment and drop zone in Tailwind. Verify that `publish.spec.js` passes, and at 360 px the dialog opens as a full-width sheet (e2e, bounding box width equals the viewport).
- [ ] 7.3 Rebuild `EmojiPicker.jsx` on DS `Popover` + `Input` (search with clear button), with no `Popper`/`ClickAwayListener`. Verify that choosing an emoji from the publish dialog inserts its tag (`publish.spec.js` emoji case, or a new one if missing).

## 8. Settings, Account and error screens

- [ ] 8.1 Rebuild `Preferences.jsx` and `Pref.jsx`: sections on DS `Card`, selects on DS `Select`, the users table on DS `ResponsiveTable`, the user dialog on `ResponsiveDialog`, and the Theme select offering System/Light/Dark. Verify that `settings.spec.js` passes.
- [ ] 8.2 Add the build marker (D10): `define` in `vite.config.js`, the footer in `Preferences.jsx`, and the `# Fork:` one-line change of the web step in `Dockerfile-build`. Verify that `NTFY_BUILD_VERSION=2.34.0-jv NTFY_BUILD_COMMIT=abc1234 npm run build`, served, shows both values in the Settings footer, and that a plain `npm start` shows `dev` (e2e test against the dev build).
- [ ] 8.3 Rebuild `Account.jsx` (Username, ChangePassword dialog, AccountType without billing, Stats with `role="progressbar"` bars, Tokens table on `ResponsiveTable` with a `DropdownMenu` per row, token and delete-account dialogs on `ResponsiveDialog`). Verify that `account.spec.js` and `tokens.spec.js` pass.
- [ ] 8.4 Rebuild `ErrorBoundary.jsx` on DS `Button` + plain links. Verify by throwing from a test-only route or a unit test that the fallback renders and its "reload" button works.

## 9. Removal and integration checks

- [ ] 9.1 Remove `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled` and `@emotion/cache` from `package.json`. Verify that `grep -rE "@mui|@emotion|stylis" web/src web/package.json` returns nothing and `npm ci && npm run build && npm test && npm run lint && npm run typecheck && npm run test:e2e` all pass.
- [ ] 9.2 Set `build.sourcemap: false` and the PWA `injectManifest` sourcemap off (D10). Verify that `find web/build -name '*.map'` and `grep -r sourceMappingURL web/build` return nothing. Record the `vite build` JS/CSS sizes before (from the last pre-change build) and after in `web/src/ds/README.md`.
- [ ] 9.3 Deploy through the `deploy-custom-image` runbook. Verify that `curl -s -o /dev/null -w '%{http_code}' https://ntfy.jvpalma.com/static/sw.js.map` does not return 200 with map content, and that the Settings footer shows the deployed version and commit.
- [ ] 9.4 Owner approval: every remaining screen (topic list and sidebar, topic view, publish dialog, subscribe dialog, subscription menu, Settings, Account, Login, error page) in light and dark, at 360 px and at desktop width, on the phone PWA and in a desktop browser. Verify with the owner ticking each screen in a checklist appended to this task.

## Workflow follow-up

- Archive this change after 9.4, then start `web-topic-groups`.
- Optionally re-copy the DS later; follow `web/src/ds/README.md`.
