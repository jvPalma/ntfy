# Proposal

## Why

The owner reads long Markdown alerts (tables, shell snippets, configs) from homelab services on the "ntfy jv" Android fork, where tables render, code is highlighted, code blocks have a copy button, the topic reads like a chat and the card text is denser. The web app at `ntfy.jvpalma.com` has none of this: tables show as raw pipes, code is uncoloured, the newest message is on top, and the cards use larger Roboto text. This change brings the web app to the behaviour the owner already approved on the phone (`HANDOFF-android-fork.md` §1, §3, §4, §5). None of it needs the design-system rewrite, so it ships first (brief `openspec/brainstorms/2026-10-27-ntfy-jv-web-fork.md`, change 2 of 4).

## What Changes

- Markdown messages render GFM tables, with horizontal scroll for wide tables.
- Fenced code blocks that name a known language are coloured with the Monokai Night palette, in both light and dark themes. The highlighter loads only when such a block is shown, covers a fixed language list with the handoff's aliases, and skips blocks above a size cap.
- Every Markdown code block gets a "󰆏 copy" button at its top right that copies only the code, shows a "copied" state, reports failure, and does not trigger anything else on the card.
- Links and images in Markdown keep passing through `sanitizeUrl`; raw HTML in a message stays inert.
- UI text uses IBM Plex Sans; code, message dates and unread counters use JetBrains Mono Nerd Font. Both are self-hosted as subset `woff2` and precached by the PWA. Roboto is removed. **BREAKING** (visual only): every screen changes font.
- Message card text (body, title, date, tags, attachment info, action buttons, code) is 80 % of today's size, all defined in one place.
- Inside a single topic, messages are in chat order: newest at the bottom, the view opens at the bottom, older messages load at the top without the view jumping, and a new message scrolls the view to it. The "All notifications" view keeps newest-first.
- The `HANDOFF-android-fork.md` "keep fork changes small" rule is applied here as written: no Dexie schema change, edited upstream lines marked `// Fork:`. Change 3 (`web-dgsl-design-system`) supersedes this rule for `web/`.

## Capabilities

### New Capabilities

- `web-message-rendering`: how a notification's body and card are rendered in the web app — Markdown features (tables, code highlighting, code copy), URL sanitising, card typography and text sizes, and the app's font families.
- `web-topic-view`: the order and scroll behaviour of the message list inside a single topic (chat order, initial position, loading history, following new messages).

### Modified Capabilities

(none — no living specs exist yet)

## Impact

- Code: `web/src/components/MarkdownContent.jsx` (plugins, code block component), `web/src/components/Notifications.jsx` (`NotificationList` order and scrolling, `NotificationItem` sizes and fonts), `web/src/components/Navigation.jsx` (unread badge font), `web/src/components/App.jsx` (MUI typography font family), `web/index.html` and `web/public/static/css/` (font faces, size variables), `web/public/static/fonts/` (new woff2 files, Roboto removed), `web/vite.config.js` (precache `woff2`), `web/public/static/langs/en.json` (copy-button strings).
- New dependencies: `remark-gfm@1` (the last major compatible with `react-remark` 2.1 / `unified` 9) and `highlight.js` (core build plus a language subset, lazy chunk).
- Tests: new unit tests in `web/src/app/`, new Playwright cases in `web/e2e/notifications.spec.js`.
- Deployment: ships through the image built in change 1 (`deploy-custom-image`). No server, API or database change.
