# Proposal

## Why

The owner sorts topics into groups ("Homelab", "DGSL", …) in the "ntfy jv" Android fork and has approved that behaviour on the phone (`HANDOFF-android-fork.md` §2). The web app at `ntfy.jvpalma.com` still shows one flat, alphabetical topic list (`web/src/components/Navigation.jsx` `SubscriptionList`), so on desktop the owner loses the grouping, the per-group unread counts and the default tab. This change ships last because it builds its new UI (tabs, menus, dialogs, selection bar) on the DGSL design-system primitives that `web-dgsl-design-system` copies into `web/src/ds/`.

## What Changes

- Each subscription can carry one group name (or none). Groups are stored per device and per logged-in user; they are not synced to the server.
- A scrollable tab bar above the sidebar topic list: `All`, one tab per group in a user-defined order, then `Ungrouped` (only when some topic has no group). Hidden when no group exists. Each label shows the summed unread count of its topics.
- Selecting a tab filters the sidebar topic list and the "All notifications" view to that tab's topics.
- The `All` tab lists topics grouped: an "Unread" section, then a "Read" section, and inside each section topics grouped by group in tab order with `Ungrouped` last, each with a small header.
- Assigning groups: a selection mode in the sidebar with a "Move to group" action (existing group, "New group…", "No group"), and a "Group" entry in each topic's menu.
- A context menu on each tab (right-click, long-press on touch): "Mark all as read", "Open by default", and for group tabs "Move left", "Move right", "Rename", "Delete".
- A default tab opens when the app starts; an unknown saved default falls back to `All` only after subscriptions have loaded.
- Validation of group names (trimmed; `All`, `Ungrouped`, empty and rename collisions rejected).
- No Dexie schema version change. No server or API change.

## Capabilities

### New Capabilities
- `web-topic-groups`: grouping of subscribed topics in the web app — assignment, group tabs with unread counts, tab actions, default tab, the grouped `All` view, and filtering of the topic list and the all-notifications view by tab.

### Modified Capabilities
<!-- none: no living specs exist yet; `web-ui-design-system` (change 3) is consumed, not changed -->

## Impact

- **Depends on**: `web-dgsl-design-system` being implemented (DS primitives in `web/src/ds/`: `ui/Tabs`, `ui/ContextMenu`, `ui/DropdownMenu`, `ui/Dialog` or `interactive/ResponsiveDialog`, `ui/Input`, `interactive/SelectionBar`).
- **Code**: `web/src/app/SubscriptionManager.js` (group field helpers), `web/src/app/Prefs.js` (group order, default tab), `web/src/app/Notifier.js` (close a topic's system notifications), `web/src/components/Navigation.jsx` (tab bar, grouped list, selection mode), `web/src/components/SubscriptionPopup.jsx` (Group entry), `web/src/components/Notifications.jsx` (`AllSubscriptions` filter), `web/src/components/App.jsx` (selected tab state), new files for the group UI and pure group logic, `web/public/static/langs/en.json` (strings).
- **Data**: new unindexed `group` field on `subscriptions` rows; new `prefs` keys `subscriptionGroupOrder` and `subscriptionGroupDefaultTab`. Rolling back to upstream leaves them unused and harmless.
- **Tests**: vitest units for the pure group logic and the manager/prefs helpers; Playwright e2e for the main flows in `web/e2e/`.
- **Server / API**: none. `AccountApi` never sends the group.
