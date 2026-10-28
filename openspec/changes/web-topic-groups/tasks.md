# Tasks

Prerequisite: `web-dgsl-design-system` is implemented. `web/src/ds/` exists, and MUI is gone. Run commands from `web/`.

## 1. Data layer

- [ ] 1.1 Create `src/app/groups.js` with `normalizeGroupName`, `validateGroupName` (`ok | empty | reserved | taken`, reserved `All`/`Ungrouped` case-insensitive), `groupNames`, `tabsFor` (labels `Name (N)`, `Ungrouped` only when needed, missing-from-order groups alphabetical after), `inTab` and `allTabSections` (Unread/Read, groups in tab order, ungrouped last, no section headers when nothing is unread; internal subscriptions excluded). Add `src/app/groups.test.js` covering every scenario of the spec requirements "Group name rules", "Group tab bar", "Unread count per tab" and "Grouped All tab". Verify with `npm test -- groups`.
- [ ] 1.2 Add `setGroup(ids, name|null)`, `renameGroup(from, to)` and `deleteGroup(name)` to `SubscriptionManager`. `setGroup` removes the field for `null`. Rename and delete each run in one transaction. Extend `SubscriptionManager.test.js` to cover: the group survives `syncFromRemote` upsert; a row removed by sync takes its group with it; rename and delete change every matching row. Verify with `npm test -- SubscriptionManager`.
- [ ] 1.3 Add `subscriptionGroupOrder`/`setSubscriptionGroupOrder` and `subscriptionGroupDefaultTab`/`setSubscriptionGroupDefaultTab` (absent = `null`/All, `""` = Ungrouped) to `Prefs.js`. Rename and delete in 1.2 update the order and the default as design D2 says. Extend `Prefs.test.js` and verify with `npm test -- Prefs`.
- [ ] 1.4 Add `notifier.cancelAll(subscription)`, which closes the service-worker notifications whose tag starts with `${baseUrl}/${topic}/` and does nothing when notifications are unsupported. Verify with a unit test using a mocked `registration.getNotifications`.

## 2. Tab bar and filtering

- [ ] 2.1 Add `selectedGroupTab` state to `Layout` in `App.jsx`, initialised once from the default-tab pref after both the pref and `subscriptions` are defined, with the fallback rule from design D5. Pass it to `Navigation` and through the outlet context. Verify: an e2e test with the default set to a group opens on that group's tab after a reload.
- [ ] 2.2 Create the group tab bar component (DS `Tabs`, horizontally scrollable, selected tab scrolled into view, hidden with no groups) and render it under the "Topics" subheader in `Navigation.jsx`. Verify in the browser at 280 px sidebar width with 8+ groups, then with 0 groups (no tab bar, list unchanged).
- [ ] 2.3 Filter the sidebar topic list by the selected tab, and render the `All` tab through `allTabSections` with section and group headers styled as design D9. Verify in light and dark themes that headers use `text-primary-emphasis` and `text-muted-foreground`, and that the order matches the spec scenarios.
- [ ] 2.4 Filter `AllSubscriptions` (`Notifications.jsx`) to the messages of topics in the selected tab. Verify: selecting `Homelab` shows only Homelab messages, and `All` shows every message.
- [ ] 2.5 Add the `nav_group_*` strings to `public/static/langs/en.json`, and use `t()` for every new label, header and dialog text. Verify with `npm run lint` and `npm test -- i18n`.

## 3. Assigning groups

- [ ] 3.1 Add selection mode to the sidebar topic list: a "Select" button in the subheader, 500 ms touch long-press on an item, checkboxes, click toggles, Escape and Cancel exit. The DS `SelectionBar` shows the selection count. Verify by selecting and deselecting topics without navigating away.
- [ ] 3.2 Add the "Move to group" action (DS `DropdownMenu`: existing groups, "New group…", "No group") and a reusable group-name dialog (DS `Input` + `<datalist>` of existing names, inline error from `validateGroupName`). "New group…" with an existing name reuses that group. Verify every scenario of the spec requirement "Move topics to a group".
- [ ] 3.3 Add a "Group…" entry to the topic menu in `SubscriptionPopup.jsx`. It opens the group-name dialog prefilled with the current group, and an empty value ungroups the topic. Verify every scenario of the spec requirement "Group field per topic".

## 4. Tab actions

- [ ] 4.1 Wrap each tab in DS `ContextMenu` with "Mark all as read" and "Open by default" / "Opens by default ✓" on every tab, and "Move left", "Move right", "Rename", "Delete" on group tabs only. Move left/right are disabled at the ends. Verify by right-click on desktop and 700 ms long-press in the browser's touch emulation.
- [ ] 4.2 Wire "Mark all as read" (`markNotificationsRead` plus `cancelAll` for each topic in the tab), the default tab, move left/right (saves the order), rename (the dialog in rename mode) and delete (DS `AlertDialog` confirmation, topics become ungrouped, the default resets to `All` if needed). Verify every scenario of the spec requirements "Tab context menu", "Mark a tab as read", "Reorder group tabs", "Rename and delete a group" and "Default tab".

## 5. Integration checks

- [ ] 5.1 Add `e2e/groups.spec.js` covering: create a group through selection mode, the tab appears with its count, filter by tab, the grouped All tab headers, rename, delete, and the default tab after a reload. Verify with `npm run test:e2e -- groups`.
- [ ] 5.2 Open the app in two browser windows, move a topic to a group in one, and confirm the other updates without a reload (spec "Groups stay in sync across open windows").
- [ ] 5.3 Run `npm run build`, `npm test`, `npm run lint` and `npm run test:e2e`. All pass.
- [ ] 5.4 Owner check on the phone (installed PWA) and on desktop, light and dark, against `HANDOFF-android-fork.md` §2 items 1–7. Record the approval in the change folder.

## Workflow follow-up

- Deploy with the `deploy-custom-image` procedure (build `ntfy-jv:<shortsha>` from a clean export, then `up -d --no-deps ntfy`).
- Archive the change after the owner approves.
