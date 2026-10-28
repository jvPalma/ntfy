# Design

## Context

See `proposal.md` (Why) and `specs/web-topic-groups/spec.md` (behaviour). Source of truth for the behaviour: `HANDOFF-android-fork.md` §2. Decisions taken in the brief: `openspec/brainstorms/2026-10-27-ntfy-jv-web-fork.md` (change 4).

Current state that shapes the approach:

- **Prerequisite**: `web-dgsl-design-system` is implemented. MUI and Emotion are gone, and the DS primitives live in `web/src/ds/` as TSX. The names below are the DS source names in `~/dgsl/design/ds/src`: `ui/Tabs`, `ui/ContextMenu`, `ui/DropdownMenu`, `ui/Input`, `ui/Dialog` / `interactive/ResponsiveDialog`, `interactive/SelectionBar`. Whichever of these change 3 did not copy is copied here with the same rules (README records the DS commit).
- **The web "home page" is the sidebar.** The Android home page is the topic list. On the web, that list is `Navigation.jsx` → `SubscriptionList`: it sorts topics alphabetically by URL and shows an unread `Badge`. The main pane at `/` is `AllSubscriptions` (`Notifications.jsx:48`), which shows every topic's messages merged.
- **Data**: `App.jsx:123` `useLiveQuery(() => subscriptionManager.all())`. `all()` already returns each row with its unread count `new` (`SubscriptionManager.js:15-20`). Dexie stores only declared indexes (`db.js:8`), so undeclared fields on a row are kept as-is. The database is per user (`ntfy-<username>`, `db.js:11`).
- **Account sync** (`AccountApi.js:473` → `SubscriptionManager.syncFromRemote`, `:109-138`):
  - `upsert()` merges `{...existing, ...opts}`, and its `opts` hold only `displayName` and `reservation` (`:85-92`), so it keeps any other field.
  - Rows that no longer exist remotely go through `remove()`, which deletes the row (`:163-166`).
  - Nothing sends the whole row to the server: `addSubscription` sends `base_url` and `topic`, and `updateSubscription` is called only with `display_name` (`SubscriptionPopup.jsx:304`).
- **System notifications** are tagged `${baseUrl}/${topic}/${sequenceId}` (`notificationUtils.js:58`). `Notifier.cancel` closes one by tag (`Notifier.js:37-50`).

## Goals / Non-Goals

**Goals:**
- Keep all group logic (tab list, labels, sections, ordering, name rules) in one pure, unit-tested module, so the UI only renders what it returns.
- Add no extra IndexedDB queries for counts.
- No Dexie version bump, no server change.

**Non-Goals:**
- Syncing groups between devices or to the Android app. This is a follow-up and needs server storage.
- Drag-and-drop reordering of tabs. Move left/right matches Android.
- Putting the selected tab in the URL. It is session state; the default tab covers start-up.

## Decisions

### D1. The group lives on the subscription row
Store `group: "<name>"` as an unindexed field on the `subscriptions` row. Remove the field when the topic has no group.
- Why: Dexie keeps undeclared fields without a schema change. `upsert()` merges, so sync keeps the group. Deleting the row (by unsubscribe or sync) deletes the group, so no orphaned keys are left. `useLiveQuery` re-renders on change in every open window. Rolling back to the upstream image ignores the field.
- Not sent to the server: confirmed by the `AccountApi` calls above. A test asserts that `syncFromRemote` keeps `group`.
- Rejected: `localStorage` keyed by subscription id. It is shared across users, not reactive, and leaves orphaned keys after sync removes a topic. Also rejected: a `prefs` row per subscription. It needs cleanup in `remove()` and sync, and adds a second place for per-topic data.
- Rename and delete run in one Dexie transaction over `subscriptions` (filter on `group`, then modify), so a partial rename can never show.

### D2. Order and default tab live in `prefs`
New `Prefs` methods, using the existing `prefs` store (`&key`):

| Key | Value |
|---|---|
| `subscriptionGroupOrder` | array of group names in tab order |
| `subscriptionGroupDefaultTab` | absent = `All`, `""` = `Ungrouped`, otherwise the group name |

Tab keys in code match Android: `null` = All, `""` = Ungrouped, otherwise the group name.
- The order is tidied lazily: names with no topics are dropped when the order is next written. The tab list is always derived from the groups that exist (spec "Group not in saved order"). Creating a group appends it. Rename replaces it in place. Delete removes it.
- Rename and delete also update `subscriptionGroupDefaultTab` when it points to the affected group (rename keeps the default, delete resets it to `All`).

### D3. Pure group module
New `web/src/app/groups.js` (plain JS, like the rest of `app/`), with functions such as:
- `groupNames(subscriptions, order)`
- `tabsFor(subscriptions, order)`, returning `{key, label, count}[]` with `Ungrouped` only when needed
- `inTab(subscription, key)`
- `allTabSections(subscriptions, order)`, returning the Unread and Read sections, each holding groups with their headers; with no unread topic it returns a single unnamed section
- `normalizeGroupName(name)`
- `validateGroupName(name, existing, {renaming})`, returning `ok | empty | reserved | taken`

Counts are sums of `subscription.new` from the list `App.jsx` already loads. There is no extra query. Internal subscriptions (`internal: true`) are excluded everywhere, as `SubscriptionList` does today.

### D4. Layout: one tab bar at the top of the sidebar topic list, desktop and mobile alike
The tab bar (DS `Tabs`, scrollable list) sits under the "Topics" subheader in `Navigation.jsx`. That is the same component in the permanent desktop drawer and in the mobile drawer. The selected tab also filters the `AllSubscriptions` view.
- Why: the sidebar *is* the web topic list, so this is the closest match to the Android home page the owner approved. One UI serves both widths. The Unread/Read split, the per-tab counts and the default tab all belong to a "selected tab" concept that collapsible sections don't have.
- Rejected: collapsible sidebar sections (DS `Collapsible`/`SidebarTree`). That design would need a separate rule for the Unread/Read split (a topic can't sit in its group and in "Unread" at once), it has no single "default tab", and it would make the desktop behave unlike the phone.
- Width: the sidebar is 280 px, so the tabs scroll horizontally. Labels are not truncated, and the selected tab scrolls into view.

### D5. Selected-tab state and the default-tab fallback
`selectedGroupTab` lives in `Layout` (`App.jsx`). It reaches `Navigation` as a prop and `AllSubscriptions` through the existing outlet context.
- Initialisation: read `prefs.subscriptionGroupDefaultTab()` with `useLiveQuery`. Once **both** the prefs value and `subscriptions` are defined (Dexie live queries return `undefined` until loaded), set the selected tab once. If the saved key is not among the current tab keys at that point, select `All` and clear the saved default.
- This reproduces the Android pitfall fix. "Loaded" here means `subscriptions !== undefined`, which is stricter than Android's `isNotEmpty()`. An empty but loaded list has no groups, so falling back to `All` is correct.
- If the selected tab disappears later (its last topic moved out, or its group deleted), select `All` without changing the saved default unless the group was deleted.

### D6. Assigning groups
- **Selection mode**: a "Select" icon button in the topics subheader, plus a long-press (500 ms, touch only) on a topic item, enters selection mode. Items then show checkboxes, and clicking an item toggles it instead of navigating. The DS `SelectionBar` shows the count, a "Move to group" action (a DS `DropdownMenu` with existing groups, "New group…" and "No group") and a cancel button. Escape cancels.
- **Topic menu**: `SubscriptionPopup.jsx` gets a "Group…" entry next to "Change display name". It opens a dialog built like `DisplayNameDialog`: a DS `Input` with a `<datalist>` of existing names. This follows the brief's Autocomplete → `<datalist>` rule.
- Both paths call `subscriptionManager.setGroup(ids, name | null)` after `normalizeGroupName` and `validateGroupName`. "New group…" with an existing name (case-insensitive) reuses that group (spec).

### D7. Tab context menu
Each tab trigger is wrapped in DS `ContextMenu`, which is built on Radix. Radix opens on secondary click and on a 700 ms touch long-press (checked in `@radix-ui/react-context-menu`), and supports the keyboard context-menu key. The menu entries follow the spec. "Rename" opens the same name dialog as D6, with rename validation. "Delete" asks for confirmation with a DS `AlertDialog`, because it changes many topics at once.

### D8. Mark a tab as read
For each topic in the tab, `subscriptionManager.markNotificationsRead(id)` (it already exists) and the new `notifier.cancelAll(subscription)`. `cancelAll` gets the service worker registration's notifications and closes those whose tag starts with `${baseUrl}/${topic}/`. It does nothing when notifications are not supported, like `cancel`.

### D9. Headers in the grouped All tab
- Section header: `text-primary-emphasis` (the DS ink, not the `primary` fill, per DS rule 4.3), medium weight, the DS size nearest 15 px.
- Group header: `text-muted-foreground`, the DS size nearest 12 px, uppercase, `tracking-wide` (≈0.05em).
- Headers are list subheaders (`role="presentation"` text, or `<li>` headings), not focusable items.

### D10. Strings
New keys go in `web/public/static/langs/en.json` only (`nav_group_*`, `subscription_group_*`). Other languages fall back to English through i18next, which is the existing behaviour for missing keys.

## Risks / Trade-offs

- [Groups are per browser and per user; clearing site data loses them] → Accepted in the brief (per-device, like Android). Server sync is a follow-up.
- [Long-press on a topic item conflicts with the browser's own long-press menu on mobile] → `preventDefault` on `contextmenu` for topic items only while the long-press handler is active. The e2e test covers the click path; the owner checks touch on the phone.
- [Upstream later declares a `group` index or field with another meaning] → `web/` is a hard fork after change 3; any upstream merge of `db.js` is reviewed by hand anyway.
- [A saved order that drifts from the real groups] → The tab list is always derived from the rows (D2). The order is advisory and tidied on write.

## Migration Plan

- No data migration. Existing rows have no `group`, so every topic starts ungrouped, there is no tab bar, and the UI looks unchanged.
- Rollback: deploying an earlier image ignores the `group` field and the two prefs keys.

## Open Questions

None. The layout question from the brief is settled in D4.
