# Tasks

## 1. Setup

- [x] 1.1 Run `cd web && npm ci`, then `npm test` and `npm run lint`; verify both pass before any edit (baseline)
- [x] 1.2 Add `remark-gfm@^1.0.0` and `highlight.js@^11` to `web/package.json` dependencies with `npm install`; verify `npm ls remark-gfm highlight.js` shows them and `npm ls unified` still resolves `unified@9` only

## 2. Fonts (spec: App fonts; design D5)

- [x] 2.1 Generate subset woff2 files with `uvx --from 'fonttools[woff]' pyftsubset` from `~/projects/ntfy-android/app/src/main/res/font/` (`ibm_plex_sans_variable.ttf`, `ibm_plex_sans_italic_variable.ttf`, `jetbrains_mono_nf_regular.ttf`, `jetbrains_mono_nf_bold.ttf`) into `web/public/static/fonts/` with the ranges in design D5; verify with `ls -l` that each Plex file is under 120 KB and each mono file under 60 KB, and with `uvx --from fonttools ttx -t cmap -o - <file>` that the mono files contain `0xf018f` and `0xf012c`
- [x] 2.2 Write `web/public/static/fonts/README.md` with the exact `pyftsubset` commands and source paths; verify that running the README commands again reproduces byte-identical files
- [x] 2.3 Rewrite `web/public/static/css/fonts.css` with the `IBM Plex Sans` (100–700, normal and italic) and `JetBrains Mono NF` (400, 700) faces, `font-display: swap`; delete the four `roboto-v29-latin-*.woff2` files; verify `grep -rn Roboto web/public web/src web/index.html` returns nothing
- [x] 2.4 Create `web/public/static/css/fork.css` with `--ntfy-font-mono` and the mono rules for `code`, `pre`, `.ntfy-date`, `.ntfy-count`; link it in `web/index.html` after `fonts.css`; verify the link is present in `build/index.html` after `npm run build`
- [x] 2.5 In `web/src/components/App.jsx` add `typography.fontFamily` (`"IBM Plex Sans", system-ui, sans-serif`) to the `createTheme` call with a `// Fork:` comment; add `className="ntfy-date"` to the date `Typography` in `Notifications.jsx` and `className="ntfy-count"` to the unread `Badge` in `Navigation.jsx` (`// Fork:` comments); verify with `npm run start` and DevTools that the body computes to IBM Plex Sans and the date and badge to JetBrains Mono NF
- [x] 2.6 Add `woff2` to `injectManifest.globPatterns` in `web/vite.config.js`; verify `npm run build` lists the four woff2 files in the precache manifest (`grep -c woff2 build/sw.js` ≥ 4)
- [x] 2.7 Add a Playwright case to `web/e2e/notifications.spec.js` that publishes a message and asserts the computed `font-family` of the body contains `IBM Plex Sans` and of the date contains `JetBrains Mono NF`, and that no request goes to a host other than the ntfy server; verify `make web-e2e` passes it

## 3. Compact cards (spec: Compact message cards; design D6)

- [x] 3.1 Declare the `--ntfy-card-*` variables in `fork.css` and replace the sizes in `NotificationItem` and `Attachment` (`Notifications.jsx`: date and tags `fontSize: 14`, title `h5`, body `body1`, attachment `body2`, action `Button`s, `UserActions` buttons) with `var(--ntfy-card-…)` (`// Fork:` comments); verify in DevTools that body is 12.8 px, title 19.2 px, date and tags 11.2 px at default zoom
- [x] 3.2 Add a Playwright case asserting the computed body font size is `12.8px` and the date `11.2px`; verify `make web-e2e` passes it

## 4. Markdown tables and safety (spec: Markdown tables, Markdown stays safe; design D1)

- [x] 4.1 In `MarkdownContent.jsx` pass `remarkPlugins: [remarkGfm]` to `useRemark` and add table rules to `fork.css` (`.ntfy-markdown table` with `display: block; overflow-x: auto; max-width: 100%`, borders and cell padding in both themes); add `className="ntfy-markdown"` to the container; verify a pasted table renders in `npm run start`
- [x] 4.2 Add Playwright cases: a Markdown table renders `th` "a"/"b" and `td` "1"/"2"; at a 390 px viewport a 12-column table leaves `document.documentElement.scrollWidth <= 390`; a plain-text message with pipes renders no `table`; verify `make web-e2e` passes them
- [x] 4.3 Add Playwright cases for safety: `[x](javascript:alert(1))` renders an `a` with empty `href`; `<img src=x onerror=alert(1)>` creates no `img`; verify `make web-e2e` passes them with no page errors (the fixture fails on any uncaught error)

## 5. Code highlighting and copy button (spec: Code highlighting, Highlighting does not slow down other messages, Copy button; design D2–D4)

- [x] 5.1 Create `web/src/app/codeHighlight.js` (core `highlight.js`, the 12 registered languages, `resolveLanguage`, `highlight` with the 20,000-character cap) and `web/src/app/codeHighlight.test.js` covering every alias, an unknown language (`null`), the size cap (`null`), and that `<script>alert(1)</script>` comes out with `&lt;script&gt;`; verify `npm test` passes
- [x] 5.2 Add the Monokai Night rules (D3 table) to `fork.css` under `.ntfy-code`, the same in both themes; remove the `pre` background switch from the Emotion container in `MarkdownContent.jsx` (keep it for `blockquote`); verify visually in light and dark with a bash, TypeScript and YAML sample
- [x] 5.3 Add the `pre` component to `rehypeReactOptions.components` in `MarkdownContent.jsx`: plain text first, then lazy `import("../app/codeHighlight")` only when `resolveLanguage` returns a language, highlighted HTML set on `<code>`; verify in DevTools Network that a topic without code blocks never requests the `codeHighlight` chunk and one with a `bash` block does
- [x] 5.4 Add the copy button to the same component (sibling of `<pre>`, top right, `aria-label` from `notifications_code_copy_label`, "󰆏 copy" / "󰄬 copied" for 2 s, `stopPropagation`, trailing newline trimmed) and the `onCopyError` prop wired through `NotificationBody` to a second `Snackbar` in `NotificationList`; add the four `notifications_code_*` strings to `web/public/static/langs/en.json`; verify `npm run lint` passes
- [x] 5.5 Add Playwright cases (grant `clipboard-read`/`clipboard-write`): a `bash` block shows `#75715E` on the comment span and `rgb(31, 31, 31)` background in light and dark; clicking "Copy code" puts exactly the code on the clipboard, shows "copied", and does not show "Copied to clipboard"; the button is reachable with Tab; verify `make web-e2e` passes them

## 6. Chat order in a topic (spec: web-topic-view; design D7)

- [x] 6.1 Add the `chatOrder` path to `NotificationList` in `Notifications.jsx` (reversed window, top sentinel with `IntersectionObserver` on `#main`, anchor preservation in `useLayoutEffect`, pinned-to-bottom state with `ResizeObserver`, scroll on new newest id, reset on topic switch) and pass `chatOrder` from `SingleSubscriptionList` only (`// Fork:` comments); verify `AllSubscriptionsList` code path is unchanged in the diff
- [x] 6.2 Add Playwright cases in `web/e2e/notifications.spec.js`: with 3 messages the topic lists oldest→newest top→bottom; with 50 messages the newest card is fully visible above the message bar on open; scrolling to the top loads older messages and the previously top card keeps its position within 5 px; a message published while scrolled up ends fully visible; "All notifications" still shows the newest first; verify `make web-e2e` passes them
- [x] 6.3 Update any existing e2e assertion that depended on newest-first order in a single topic; verify the full `make web-e2e` suite passes

## 7. Integration

- [x] 7.1 Run `npm run build`, `npm test`, `npm run lint` and `make web-e2e`; verify all pass and the `vite build` output lists `codeHighlight` as its own chunk, separate from the `MarkdownContent` chunk
- [ ] 7.2 Deploy with change 1's procedure and have the owner compare the same Markdown message (table, bash, TypeScript, YAML) on the Android fork and the web at phone width and desktop width, in light and dark; record the approval (or the variable values changed in `fork.css`) in this change's folder
- [ ] 7.3 Install the PWA on the phone, open it once online, then offline; verify text still renders in IBM Plex Sans and JetBrains Mono NF

## Workflow follow-up

- Archive the change after owner approval (task 7.2), which creates the `web-message-rendering` and `web-topic-view` living specs that change 3 (`web-dgsl-design-system`) builds on.
