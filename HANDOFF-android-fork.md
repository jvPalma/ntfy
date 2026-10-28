# Handoff: custom changes in the "ntfy jv" Android fork

Written 2026-10-27. Purpose: port the same behaviour to this server fork (mainly the web app in `web/`, served at `https://ntfy.jvpalma.com`).

## Context

| Item | Value |
|---|---|
| Android fork | `~/projects/ntfy-android`, branch `jvPalma/dev`, remote `git@github.com:jvPalma/ntfy-android.git` |
| Android changes | Uncommitted working tree on top of upstream `d9e11bad`. See them with `git -C ~/projects/ntfy-android diff` and `git status` |
| App id / label | `com.jvpalma.ntfy` / "ntfy jv" (debug: `com.jvpalma.ntfy.debug`, "ntfy (debug)"). Installs next to the official app |
| Server in production | Official image `binwiederhier/ntfy:v2.34.0`, container `jvpalma-ntfy`, compose `~/jvpalma-homelab/docker-compose.1102x.yml`. This repo is not deployed yet |
| Server config | `~/jvpalma-homelab/apps/ntfy/.env`; `NTFY_MESSAGE_SIZE_LIMIT=32K` was raised so long Markdown fits in one message |
| Server usage docs | `~/.claude/skills/ntfy/SKILL.md` (topics, users, tokens, limits) |

Design rule used throughout the Android fork: **keep fork changes small and isolated from upstream code**, so upstream merges stay easy. No database schema changes. New code lives in new files where possible, and edited upstream lines carry a `// Fork:` comment. Apply the same rule here.

The owner tested and approved all features below on the phone.

---

## 1. Topic view in chat order

**Behaviour**
- Inside a topic, the newest message is at the **bottom**, like a chat.
- The topic opens scrolled to the bottom. Scrolling up goes back in history.
- When a new message arrives, the list scrolls to it (at the bottom).

**Android implementation**
- `app/src/main/res/layout/activity_detail.xml`: `app:reverseLayout="true"` on the RecyclerView. The adapter order (newest first) is unchanged; the layout manager draws it bottom-up.
- `ui/DetailActivity.kt`: the existing "scroll to position 0 on insert" logic now lands on the bottom; only comments and the log text changed.

**Web pointer:** `web/src/components/Notifications.jsx` renders the list newest-first. Reverse the rendered order (or use `flex-direction: column-reverse`), start scrolled to the bottom, keep infinite scroll loading older messages at the top.

---

## 2. Groups (tabs) on the home page

**Behaviour (the most important feature)**
1. The user puts each subscribed topic in a **group** (one group per topic, or none). Example: homelab services in "Homelab", DGSL topics in "DGSL".
2. The home page shows a scrollable **tab bar** above the topic list: `All`, one tab per group, then `Ungrouped` (only when some topic has no group). The tab bar is hidden when no group exists.
3. Each tab label shows the **unread count** of all topics in it: `Homelab (12)`. No count when zero.
4. **Assigning groups**, two ways:
   - Multi-select topics on the home page (long press), then the toolbar action **"Move to group"** (folder icon) opens a list: existing groups, "New group…" (asks for a name), "No group".
   - Per topic: the topic settings screen has a **Group** text field. Its dialog lists the existing group names as a hint. Empty = no group.
5. **Long press on a tab** opens a menu:
   - **Mark all as read**: marks every topic in that tab as read and dismisses their system notifications.
   - **Open by default** (shows "Opens by default ✓" when already set): this tab opens when the app starts.
   - Group tabs only: **Move left**, **Move right** (reorder), **Rename**, **Delete** (topics become ungrouped; the group disappears).
6. **Default tab**: `All`, `Ungrouped` or any group. If the saved default no longer exists, fall back to `All`, but only after the subscription list has loaded (see pitfall below).
7. **The `All` tab is grouped**:
   - An **"Unread"** section on top with every topic that has unread messages, then a **"Read"** section with the rest.
   - Inside each section, topics are grouped by group, in tab order, with `Ungrouped` last, and each group has a small header.
   - Section headers only appear when at least one topic is unread. Otherwise only the group headers show.
   - Headers: section header in primary colour, 15sp, medium weight. Group header in on-surface-variant colour, 12sp, uppercase, letter spacing 0.05.

**Data model (Android)**: stored in SharedPreferences, not Room, so upstream DB migrations never conflict (`db/Repository.kt`):

| Key | Value |
|---|---|
| `SubscriptionGroup_<subscriptionId>` | group name (trimmed); key removed when no group |
| `SubscriptionGroupOrder` | group names in tab order, newline-separated. Groups missing from it sort after, alphabetically |
| `SubscriptionGroupDefaultTab` | absent = `All`, `""` = `Ungrouped`, otherwise the group name |

Tab keys used in code: `null` = All, `""` = Ungrouped, otherwise the group name. Deleting a subscription also clears its group.

**Android files**
- `db/Repository.kt`: `get/setSubscriptionGroup`, `getSubscriptionGroups()` (id → name), `get/setSubscriptionGroupOrder`, `get/setDefaultGroupTab`.
- `ui/MainActivity.kt`:
  - `showSubscriptionsOfSelectedGroup()` computes the tab keys and labels (with counts), rebuilds tabs only when the labels change, filters the list, and for `All` calls `groupedForAllTab()`.
  - Also: `onMultiMoveToGroupClick`, `onGroupTabLongClick`, `moveGroupTab`, `showGroupNameDialog`, `markGroupTabAsRead`, `isInGroupTab`.
- `ui/GroupHeaderDecoration.kt` (new): draws the headers as a RecyclerView `ItemDecoration`, keyed by the subscription id of the first item under each header. The upstream adapter is untouched.
- `ui/DetailSettingsActivity.kt`: `loadGroupPref()` (Group field). `res/xml/detail_preferences.xml`: the `EditTextPreference`.
- `res/layout/activity_main.xml`: `TabLayout` `main_group_tabs` (scrollable, `gone` by default) between the banners and the list.
- `res/menu/menu_main_action_mode.xml` + `res/drawable/ic_folder_white_20dp.xml`: the "Move to group" action.
- `res/values/strings.xml`: `main_group_*`, `main_action_mode_menu_move_to_group`, `detail_settings_appearance_group_*`.

**Pitfall found:** the subscription LiveData first emits an **empty list** before the DB loads. Resetting an unknown default tab to `All` on that first emission discarded the saved default. The fix only falls back once `allSubscriptions.isNotEmpty()`. Expect the same with async loads on the web.

**Web pointers**
- Subscriptions live in IndexedDB via Dexie (`web/src/app/db.js`, `subscriptions: "&id,baseUrl,..."`, `SubscriptionManager.js`). Following the fork rule, keep groups out of the Dexie schema: use `localStorage` or the `prefs` store (`Prefs.js`) with the same three keys. Bumping the Dexie version would conflict with upstream.
- Home and list UI: `Navigation.jsx` (sidebar topic list) and `Notifications.jsx` (`AllSubscriptions`). On desktop, groups may fit better as collapsible sidebar sections plus a tab or filter on the "All notifications" view; that decision is open.
- Groups are **per device** (not synced). Syncing between phone and web would need server-side storage (e.g. account sync, which ntfy has for logged-in users); not done yet.

---

## 3. Markdown rendering

Messages sent with `Markdown: yes` (or `Content-Type: text/markdown`).

### 3.1 Tables
Android: `util/MarkwonFactory.kt`, `createForMessage` adds `TablePlugin.create(context)` (Markwon 4.6.2 `ext-tables`).
Web: `web/src/components/MarkdownContent.jsx` uses `react-remark`. Check whether GFM tables render; if not, add `remark-gfm` to `remarkPlugins` and style `table`, `th`, `td` (borders, padding, horizontal scroll for wide tables).

### 3.2 Syntax highlighting in fenced code blocks
When the fence names a language (` ```bash `), code is coloured with the **Monokai Night** theme (VS Code theme by fabiospampinato, `vscodethemes.com/e/fabiospampinato.vscode-monokai-night`).

Android:
- `app/build.gradle`: `io.noties.markwon:syntax-highlight:4.6.2`, `io.noties:prism4j:2.0.0`, `annotationProcessor io.noties:prism4j-bundler:2.0.0`. All of them exclude `org.jetbrains:annotations-java5`, because of a duplicate class `org.intellij.lang.annotations`.
- `util/Prism.java` (new): `@PrismBundle(includeAll = true)` plus:
  - aliases: `sh/shell/zsh/console→bash`, `js/ts/typescript/jsx/tsx→javascript`, `html/xml/svg→markup`, `py→python`, `kt→kotlin`, `yml→yaml`, `golang→go`, `cs→csharp`, `c++→cpp`, `md→markdown`
  - a custom **bash** grammar, because Prism4j has none: comment, string, variable, keyword, boolean, common commands as function, `-flags` as parameter, operator, number
- `util/Prism4jThemeMonokaiNight.java` (new): the theme.

Colour table (use the same in a Prism/highlight.js CSS theme on the web):

| Tokens | Colour |
|---|---|
| background | `#1F1F1F` |
| default text | `#DDDDDD` |
| comment, prolog, doctype, cdata | `#75715E` |
| string, char, attr-value, regex, url | `#E6DB74` |
| keyword, operator, tag, selector, important, atrule, deleted | `#F92672` |
| number, boolean, constant, symbol, entity | `#AE81FF` |
| function, class-name, attr-name, inserted | `#A6E22E` |
| builtin, annotation, namespace | `#66D9EF` |
| variable, parameter | `#FD971F` |
| property | `#CFCFC2` |
| punctuation, delimiter | `#F8F8F2` |

Web: add `rehype-prism-plus` or `rehype-highlight` (supports bash and TypeScript natively, so no custom grammar is needed) with a CSS theme built from the table.

**Pitfall found:** the syntax colours vanished when the copy button code removed and re-added the code-block span. The span repainted all text in the default colour on top of the token colours. On the web, add the copy button **without re-rendering or re-wrapping** the highlighted `<code>`.

### 3.3 Copy button on code blocks
- A small **"󰆏 copy"** label (Nerd Font icon `nf-md-content_copy`, U+F018F, then the word "copy") at the **top right** of every code block, link colour, 85% size.
- Tapping it copies **only the code** (without the fence padding) to the clipboard.
- The tap must **not propagate**: the message card's own click (copy the whole message) is skipped for that tap.

Android: `util/CodeBlockCopy.kt` (new) inserts the label inside the code-block span, on its first padding line, with `AlignmentSpan(OPPOSITE)`, `RelativeSizeSpan(0.85)` and a `ClickableSpan`. The span sets view tag `R.id.tag_span_clicked` to a timestamp, and `ui/DetailAdapter.kt` ignores card clicks within 500 ms of it. Used via `markwon.setParsedMarkdown(view, CodeBlockCopy.addCopyButtons(ctx, markwon.toMarkdown(text)))`.

Web: wrap each `pre` with a positioned container and a button (`position:absolute; top; right`), use `navigator.clipboard.writeText(code)` and `event.stopPropagation()`.

---

## 4. Fonts

| Use | Font |
|---|---|
| All UI text | **IBM Plex Sans** (variable font; regular 400, bold 700, italic; "medium" family for titles and labels) |
| Code (inline and blocks), message dates, unread count badges | **JetBrains Mono Nerd Font** (regular + bold), so Nerd Font icons render |

Android:
- `res/font/`: `ibm_plex_sans_variable.ttf`, `ibm_plex_sans_italic_variable.ttf` (from Google Fonts), `jetbrains_mono_nf_regular.ttf`, `jetbrains_mono_nf_bold.ttf` (from `~/.fonts/JetbrainsNerdFonts`).
- Font families: `ibm_plex_sans.xml` (weights via `fontVariationSettings 'wght'`), `ibm_plex_sans_medium.xml`, `jetbrains_mono.xml`.
- `res/values/themes.xml`: `fontFamily` = Plex on AppTheme, plus `TextAppearance.Ntfy.*` overrides for the whole Material 3 type scale. Title M/S and Label L/M/S use the medium family.
- `fragment_detail_item.xml` (date) and `fragment_main_item.xml` (date + new-count badge): `@font/jetbrains_mono`.
- `MarkwonFactory.kt`: `codeTypeface` / `codeBlockTypeface` = JetBrains Mono.

Web: `@font-face` for both (self-host the files in `web/public/static/`), set `typography.fontFamily` in `web/src/components/theme.js`, and use JetBrains Mono for `code`, `pre`, dates and counters.

---

## 5. Text sizes in message cards (−20 %)

All defined in one file, `res/values/fork.xml`:

| Element | Upstream | Fork |
|---|---|---|
| Message body | 18sp | **14.4sp** |
| Message title | 18sp | **14.4sp** |
| Code (inline + blocks) | — | **12.5sp** |
| Date | 14sp | **11.2sp** |
| Tags | 14sp | **11.2sp** |
| Attachment info | 14sp | **11.2sp** |
| Action buttons | 14sp | **11.2sp** |

Applied in `fragment_detail_item.xml`, `button_action.xml` (action buttons) and `MarkwonFactory.kt` (code). Tables and other Markdown elements inherit the body size. Web: apply the same ratios (×0.8) in `Notifications.jsx` / `MarkdownContent.jsx` styles.

---

## 6. Other fork-only changes (Android only, nothing to port)
- `applicationId "com.jvpalma.ntfy"`, `app_name` "ntfy jv".
- Build: `./gradlew --no-daemon -q assembleFdroidDebug` (flavor `fdroid`, no Firebase). Android SDK `~/Android/Sdk`. APK `app/build/outputs/apk/fdroid/debug/app-fdroid-debug.apk`, delivered to the phone through Telegram `sendDocument`.
- The project has no unit tests; everything was verified on the phone.

## Suggested order for the web port
1. Fonts + −20 % sizes (small, visible).
2. Markdown tables, syntax highlighting (Monokai Night), copy button.
3. Chat order in the topic view.
4. Groups: data in localStorage/prefs, then sidebar or tab UI, unread counts, the grouped "All" view, default tab, and tab actions.
