# Design

## Context

See `proposal.md` for the motivation and `specs/` for the behaviour. Facts that shape the approach:

- `web/src/components/MarkdownContent.jsx` renders Markdown with `react-remark` 2.1.0, which pins `unified` 9, `remark-parse` 9, `remark-rehype` 8 and `rehype-react` 6 (`web/package-lock.json`). The component is already lazy-loaded from `Notifications.jsx` (`lazy(() => import("./MarkdownContent"))`). Links and images go through `SafeLink`/`SafeImage` (`sanitizeUrl`). Styling is one `@emotion/styled` container that switches the `pre` background by theme (`#f5f5f5` / `#333`).
- `remark-rehype` 8 without `allowDangerousHtml` drops raw HTML nodes, which is why raw HTML is inert today.
- `Notifications.jsx` `NotificationList` renders `notifications.slice(0, count)` newest-first inside `react-infinite-scroll-component` with `scrollableTarget="main"` (`App.jsx` `Main`, `overflow: auto`, `height: 100dvh`), pages of 20, `scrollThreshold=0.7`, and resets `#main` to the top when `props.id` changes. `messageBar` adds `marginBottom: 100px` so the last card clears the fixed publish bar. `SingleSubscriptionList` passes `id` and `messageBar`; `AllSubscriptionsList` passes neither.
- `NotificationItem` sizes: date and tags `fontSize: 14`, title `variant="h5"` (1.5rem), body `variant="body1"` (1rem), attachment `variant="body2"` (0.875rem), action buttons MUI `Button` (0.875rem).
- Fonts: `web/index.html` links `/static/css/fonts.css` (Roboto 300/400/500/700 woff2 in `web/public/static/fonts/`). MUI uses its default Roboto stack; `App.jsx` builds the theme with `createTheme({...lightTheme|darkTheme, direction})`.
- PWA precache: `vite.config.js` `globPatterns: ["**/*.{js,css,html,ico,png,svg,json}"]` — fonts are not precached today. Files in `web/public/` are copied to `build/` and therefore matched by the glob.
- `copyToClipboard` (`web/src/app/utils.js:467`) returns a Promise; the fallback path resolves even if `execCommand` fails.
- Source fonts: `~/projects/ntfy-android/app/src/main/res/font/` holds `ibm_plex_sans_variable.ttf` (537 KB), `ibm_plex_sans_italic_variable.ttf` (600 KB), `jetbrains_mono_nf_regular.ttf` and `jetbrains_mono_nf_bold.ttf` (2.4 MB each, from `~/.fonts/JetbrainsNerdFonts`).
- No `node_modules` in `web/` yet; `npm ci` is the first step.

## Goals / Non-Goals

**Goals:**
- Stay on the current stack (MUI + Emotion + `react-remark` 2.1). Change 3 rewrites the styling in Tailwind; keep the new styling in plain CSS files and CSS custom properties so that rewrite is mostly a copy.
- Keep the Markdown chunk lazy and add the highlighter as a second, smaller lazy chunk.

**Non-Goals:**
- Upgrading `react-remark` or moving to `react-markdown` / `unified` 10+.
- Chat order in the "All notifications" view.
- A "new messages" indicator instead of auto-scroll (the Android behaviour is always scroll).
- Component tests with a DOM renderer; the project has none, behaviour is covered by Playwright.

## Decisions

### D1. Tables via `remark-gfm@1`
`remark-gfm` 1.x is the last major that works with `remark-parse` 9 / `unified` 9 (2.x+ needs `unified` 10). Pass it in `useRemark({ remarkPlugins: [remarkGfm] })`. Alternative: upgrade the whole remark stack — rejected, it drags `react-remark` out of support and is change-3 sized.

### D2. Highlighting with `highlight.js` core inside a custom `pre` component, not a rehype plugin
Register a `pre` component in `rehypeReactOptions.components`. It reads the child `code` element's `language-xxx` class and its text, renders `<pre><code>` with the plain text first, then lazy-imports `web/src/app/codeHighlight.js` and swaps in the highlighted output.
- `codeHighlight.js` imports `highlight.js/lib/core` and registers only: bash, javascript, typescript, xml, python, kotlin, yaml, go, csharp, cpp, markdown, json. It exports `resolveLanguage(name)` (alias table from the handoff: `sh/shell/zsh/console→bash`, `js/jsx→javascript`, `ts/tsx→typescript`, `html/xml/svg/markup→xml`, `py→python`, `kt→kotlin`, `yml→yaml`, `golang→go`, `cs→csharp`, `c++→cpp`, `md→markdown`) and `highlight(code, language)` returning HTML or `null` when the language is unknown or `code.length > 20000`.
- Output is injected with `dangerouslySetInnerHTML` on `<code>`. This is safe because `highlight.js` escapes every source character and only adds its own `<span class="hljs-…">` wrappers; the unit test asserts that `<script>` in the input comes out escaped.
- Alternatives: `rehype-highlight@4` (works with `unified` 9 but loads all of lowlight's languages unless configured, and runs synchronously for every Markdown message, even without code); `rehype-prism-plus` (needs `unified` 10). A component also gives us the place to put the copy button (D4) without re-wrapping the highlighted `<code>` — the pitfall the handoff records.
- Bash in `highlight.js` already covers comments, strings, variables, keywords and built-in commands, so no custom grammar is needed (the Android fork wrote one only because Prism4j has none).

### D3. Monokai Night as a CSS theme keyed on `hljs-*` classes
New file `web/public/static/css/fork.css` (linked from `index.html` after `fonts.css`) holds `.ntfy-code` rules: background `#1F1F1F`, text `#DDDDDD`, and the handoff table mapped to `highlight.js` scopes:

| Handoff tokens | `highlight.js` classes | Colour |
|---|---|---|
| comment, prolog, doctype, cdata | `hljs-comment`, `hljs-quote`, `hljs-meta` | `#75715E` |
| string, char, attr-value, regex, url | `hljs-string`, `hljs-regexp`, `hljs-link`, `hljs-char.escape_` | `#E6DB74` |
| keyword, operator, tag, selector, important, atrule, deleted | `hljs-keyword`, `hljs-operator`, `hljs-name`, `hljs-selector-tag`, `hljs-selector-id`, `hljs-selector-class`, `hljs-deletion` | `#F92672` |
| number, boolean, constant, symbol, entity | `hljs-number`, `hljs-literal`, `hljs-symbol` | `#AE81FF` |
| function, class-name, attr-name, inserted | `hljs-title.function_`, `hljs-title.class_`, `hljs-attr`, `hljs-attribute`, `hljs-addition`, `hljs-section` | `#A6E22E` |
| builtin, annotation, namespace | `hljs-built_in`, `hljs-type`, `hljs-meta .hljs-keyword` | `#66D9EF` |
| variable, parameter | `hljs-variable`, `hljs-template-variable`, `hljs-params` | `#FD971F` |
| property | `hljs-property` | `#CFCFC2` |
| punctuation, delimiter | `hljs-punctuation` | `#F8F8F2` |

The same rules apply in both themes (spec: same palette in light). Plain CSS, not Emotion, so change 3 keeps the file as is. `blockquote` keeps today's theme-dependent background; only `pre` moves to Monokai.

### D4. Copy button lives in the custom `pre` component
The `pre` component renders `<div class="ntfy-code-wrap" style="position:relative">` containing a `<button>` (absolute, top right) and the `<pre>`. The button is a sibling of `<pre>`, so highlighting is never re-wrapped. The copied text is the `code` element's raw text with one trailing newline trimmed (remark keeps a final `\n`). Handlers call `event.stopPropagation()`. On success the label switches to "󰄬 copied" (U+F012C) for 2 s via local state. On rejection `MarkdownContent` calls an `onCopyError` prop; `NotificationList` owns the toast, so it gains a second `Snackbar` message ("Could not copy code"). Strings: `notifications_code_copy` ("copy"), `notifications_code_copied` ("copied"), `notifications_code_copy_label` ("Copy code"), `notifications_code_copy_failed` ("Could not copy code") in `public/static/langs/en.json`; the Nerd Font glyph is prefixed in code, not in the string.

Because the fallback path of `copyToClipboard` always resolves, failure is only detected on the `navigator.clipboard` path. Accepted: on `https://ntfy.jvpalma.com` the Clipboard API path is the one used.

### D5. Fonts: subset woff2, one stylesheet, precached
- Generate with `uvx --from 'fonttools[woff]' pyftsubset` (one-off, outputs committed): IBM Plex Sans variable roman and italic, `--unicodes` Basic Latin + Latin-1 + Latin Extended-A + General Punctuation + `U+20AC`; JetBrains Mono NF regular and bold, the same ranges plus the Nerd Font glyphs used (`U+F018F`, `U+F012C`). `--flavor=woff2 --layout-features='*'`. Expected size: under 120 KB per Plex file, under 60 KB per mono file. The exact command is recorded in `web/public/static/fonts/README.md`.
- `fonts.css` is rewritten: Roboto faces removed (and its four woff2 files deleted), two faces for `IBM Plex Sans` (`font-weight: 100 700`, normal and italic) and two for `JetBrains Mono NF` (400, 700), all `font-display: swap`.
- MUI: `App.jsx` adds `typography: { fontFamily: '"IBM Plex Sans", system-ui, sans-serif' }` to the `createTheme` call (`// Fork:` comment). Mono usage via the CSS variable `--ntfy-font-mono: "JetBrains Mono NF", ui-monospace, monospace` in `fork.css`, applied to `code`, `pre`, the card date and the sidebar `Badge` content.
- Precache: add `woff2` to `globPatterns` in `vite.config.js`.

### D6. Card sizes as CSS custom properties
`fork.css` declares on `:root`: `--ntfy-card-body: 0.8rem`, `--ntfy-card-title: 1.2rem`, `--ntfy-card-meta: 0.7rem` (date, tags), `--ntfy-card-attachment: 0.7rem`, `--ntfy-card-action: 0.7rem`, `--ntfy-card-code: calc(var(--ntfy-card-body) * 12.5 / 14.4)`. `NotificationItem` `sx` props reference these variables. This mirrors the Android `res/values/fork.xml` single source and lets change 3 consume the same variables from Tailwind. The handoff's 11.2 px meets the owner's phone approval; the brief keeps ×0.8.

### D7. Chat order: own scroll logic, not `react-infinite-scroll-component` `inverse`
`inverse` requires `flex-direction: column-reverse` on the scroll target, which is `#main`, shared with every view. Instead, `NotificationList` gets a `chatOrder` prop (set by `SingleSubscriptionList`; `AllSubscriptionsList` keeps the current path unchanged):
- Render `notifications.slice(0, count).reverse()` (oldest at top of the loaded window).
- A sentinel `div` above the list, observed with `IntersectionObserver` (root `#main`, `rootMargin: "300px 0px 0px 0px"`), increases `count` by 20 when visible and `count < notifications.length`.
- Anchor preservation: before `count` grows, store `main.scrollHeight - main.scrollTop`; in `useLayoutEffect` after the render, set `main.scrollTop = main.scrollHeight - stored`.
- "Pinned to bottom" state: true on open and after scrolling to the bottom, false once the user scrolls more than 80 px from the bottom. While pinned, a `ResizeObserver` on the list container keeps `main.scrollTop = main.scrollHeight` (covers lazy images and Markdown chunks).
- New message: when `notifications[0].id` changes (newest), set pinned and scroll to bottom, regardless of the previous position (spec: always scroll).
- Topic switch: replace today's reset-to-top cleanup with reset `count` to 20 and pinned to true for the new `id`.
- The `marginBottom: 100px` message-bar clearance stays.

Alternative: CSS `column-reverse` on an inner scroll container — rejected, it would require a second scroll container inside `#main`, breaking the `scrollableTarget` used by the All view and the e2e tests that scroll `#main`.

## Risks / Trade-offs

- [`highlight.js` scope names differ from Prism's, so a token may get a slightly different colour from Android] → map table D3; owner compares the same bash/TS/YAML message on phone and web.
- [`dangerouslySetInnerHTML` on highlighted code] → only `highlight.js` output is injected; unit test with `<script>` and `<img onerror>` input; unknown languages render as React text.
- [Scroll anchoring flicker when older messages render with lazy content] → anchor is recomputed in `useLayoutEffect` before paint; `ResizeObserver` only acts while pinned.
- [Subsetting drops a glyph someone sends (e.g. Cyrillic)] → `font-display: swap` plus the fallback stack renders it in a system font; acceptable for a single pt-PT/en user.
- [All styling here is rewritten in change 3] → kept in `fork.css` and CSS variables, so the rewrite is mostly moving rules (~1 h, accepted in the brief).
- [12.8 px body may be too small on desktop] → one variable to change; owner approves at phone and desktop width (task 6.2).

## Migration Plan

Front-end only. Ship by rebuilding the image with change 1's procedure. Rollback: redeploy the previous `ntfy-jv:<shortsha>` image. The PWA updates itself (`registerType: "autoUpdate"`); a stuck client is fixed by reloading.
