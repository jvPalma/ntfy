# Spec Delta

## Purpose

Lets the user sort subscribed topics into named groups in the web app, browse them through group tabs with unread counts, and act on a whole group at once, matching the behaviour of the "ntfy jv" Android fork.

## ADDED Requirements

### Requirement: Topic group membership
Each subscribed topic SHALL belong to at most one group, identified by its name. A topic with no group is "ungrouped". Group membership SHALL be stored on this device for the logged-in user only and SHALL NOT be sent to the server.

#### Scenario: Assigning a group
- **WHEN** the user puts topic `homelab-health` in group "Homelab"
- **THEN** `homelab-health` appears under "Homelab" and no longer under `Ungrouped`

#### Scenario: Group kept across reloads
- **WHEN** the user reloads the app after assigning a group
- **THEN** the topic is still in that group

#### Scenario: Group not shared between users
- **WHEN** the user logs in as a different account on the same browser
- **THEN** that account sees its own groups, not the previous account's

#### Scenario: Group kept through account sync
- **WHEN** account sync refreshes a grouped topic from the server (display name or reservation)
- **THEN** the topic keeps its group

#### Scenario: Unsubscribing clears the group
- **WHEN** the user unsubscribes from a grouped topic, or account sync removes it
- **THEN** the group assignment is removed with it, and re-subscribing to the same topic starts ungrouped

### Requirement: Group name rules
A group name SHALL be trimmed of surrounding whitespace before it is saved. The app SHALL reject an empty name, the names `All` and `Ungrouped` (case-insensitive), and, when renaming, a name already used by another group (case-insensitive), and SHALL show the reason without saving.

#### Scenario: Name is trimmed
- **WHEN** the user creates the group `"  DGSL "`
- **THEN** the group is saved and shown as `DGSL`

#### Scenario: Reserved name rejected
- **WHEN** the user tries to create or rename a group to `all` or `Ungrouped`
- **THEN** nothing is saved and the dialog explains the name is reserved

#### Scenario: Empty name rejected
- **WHEN** the user submits a new group name made only of spaces
- **THEN** nothing is saved and the dialog explains the name is empty

#### Scenario: Rename collision rejected
- **WHEN** groups "Homelab" and "DGSL" exist and the user renames "DGSL" to "homelab"
- **THEN** nothing is saved and the dialog explains the name is already used

#### Scenario: Creating an existing name reuses it
- **WHEN** the user picks "New group…" and enters `homelab` while "Homelab" exists
- **THEN** the selected topics join the existing "Homelab" group and no second group is created

### Requirement: Group tab bar
The topic list SHALL show a horizontally scrollable tab bar with `All` first, then one tab per group in the saved group order, then `Ungrouped` only when at least one topic has no group. The tab bar SHALL be hidden when no group exists. Groups missing from the saved order SHALL follow it, sorted alphabetically.

#### Scenario: No groups
- **WHEN** no topic has a group
- **THEN** no tab bar is shown and the topic list looks as it does without groups

#### Scenario: Tabs in order
- **WHEN** the saved order is "Homelab", "DGSL" and some topic has no group
- **THEN** the tabs read `All`, `Homelab`, `DGSL`, `Ungrouped`

#### Scenario: Every topic grouped
- **WHEN** every topic has a group
- **THEN** there is no `Ungrouped` tab

#### Scenario: Group not in saved order
- **WHEN** a group "Media" exists but is missing from the saved order "Homelab", "DGSL"
- **THEN** the tabs read `All`, `Homelab`, `DGSL`, `Media`

#### Scenario: Many groups
- **WHEN** there are more tabs than fit the width
- **THEN** the tab bar scrolls horizontally and the selected tab is scrolled into view

### Requirement: Unread count per tab
Each tab label SHALL show the sum of unread messages of all topics in that tab, as `Name (N)`. No count SHALL be shown when the sum is zero. The counts SHALL update when messages arrive or are read, without a reload.

#### Scenario: Count shown
- **WHEN** topics in "Homelab" have 5 and 7 unread messages
- **THEN** the tab reads `Homelab (12)`

#### Scenario: Zero hides the count
- **WHEN** no topic in "DGSL" has unread messages
- **THEN** the tab reads `DGSL`

#### Scenario: Live update
- **WHEN** a new message arrives on a topic in "Homelab"
- **THEN** the `Homelab` and `All` counts go up by one without a reload

### Requirement: Tab filters the topic list and the all-notifications view
Selecting a group tab SHALL show only that group's topics in the topic list and only their messages in the "All notifications" view. `Ungrouped` SHALL show only topics without a group. `All` SHALL show every topic.

#### Scenario: Group tab selected
- **WHEN** the user selects the `Homelab` tab
- **THEN** the topic list shows only Homelab topics and "All notifications" shows only their messages

#### Scenario: Ungrouped tab selected
- **WHEN** the user selects `Ungrouped`
- **THEN** only topics without a group are listed

### Requirement: Grouped All tab
In the `All` tab, the topic list SHALL be split into an "Unread" section with every topic that has unread messages, then a "Read" section with the rest. Inside each section, topics SHALL be grouped by group in tab order, with ungrouped topics last, each group under a small header. Section headers SHALL appear only when at least one topic is unread; otherwise only group headers appear.

#### Scenario: Some topics unread
- **WHEN** "Homelab" has one unread topic and "DGSL" has none
- **THEN** the list shows header "Unread", group header "HOMELAB" with that topic, then header "Read" with the remaining topics under their group headers

#### Scenario: Nothing unread
- **WHEN** no topic has unread messages
- **THEN** no "Unread"/"Read" headers appear and topics are listed under their group headers in tab order

#### Scenario: Ungrouped last
- **WHEN** some topics have no group
- **THEN** they appear after all groups in each section, under the header "UNGROUPED"

#### Scenario: Header styles
- **WHEN** section and group headers are shown
- **THEN** section headers use the primary ink colour at a larger, medium-weight size, and group headers use the muted text colour, smaller, uppercase, with letter spacing

### Requirement: Move topics to a group
The topic list SHALL offer a selection mode in which the user selects several topics and applies "Move to group". Its menu SHALL list existing groups, "New group…" (asks for a name) and "No group".

#### Scenario: Move several topics
- **WHEN** the user selects two topics and chooses "Move to group" → "Homelab"
- **THEN** both topics are in "Homelab" and the selection mode ends

#### Scenario: New group from selection
- **WHEN** the user chooses "New group…" and enters `Media`
- **THEN** the group "Media" is created at the end of the tab order and holds the selected topics

#### Scenario: Remove from group
- **WHEN** the user chooses "No group" for selected topics
- **THEN** those topics become ungrouped

#### Scenario: Cancel selection
- **WHEN** the user leaves selection mode without choosing an action
- **THEN** no group changes

### Requirement: Group field per topic
Each topic's menu SHALL offer a "Group" entry that opens a dialog with a text field prefilled with the current group and suggesting the existing group names. Saving an empty field SHALL make the topic ungrouped.

#### Scenario: Set from the topic menu
- **WHEN** the user opens a topic's menu, chooses "Group", types `DGSL` and saves
- **THEN** the topic is in "DGSL"

#### Scenario: Suggestions
- **WHEN** the Group dialog opens and groups "Homelab" and "DGSL" exist
- **THEN** both names are offered as suggestions while typing

#### Scenario: Clear the group
- **WHEN** the user empties the field and saves
- **THEN** the topic becomes ungrouped

### Requirement: Tab context menu
Each tab SHALL open a menu on secondary click and on long-press on touch screens, with "Mark all as read" and "Open by default" (shown as "Opens by default ✓" when it is the default). Group tabs SHALL also offer "Move left", "Move right", "Rename" and "Delete".

#### Scenario: Menu on All
- **WHEN** the user long-presses the `All` tab
- **THEN** the menu offers only "Mark all as read" and "Open by default"

#### Scenario: Menu on a group tab
- **WHEN** the user right-clicks the `Homelab` tab
- **THEN** the menu also offers "Move left", "Move right", "Rename" and "Delete"

#### Scenario: Default marker
- **WHEN** `Homelab` is the default tab and its menu opens
- **THEN** the entry reads "Opens by default ✓"

### Requirement: Mark a tab as read
"Mark all as read" SHALL mark every message of every topic in that tab as read and close the browser notifications shown for those topics.

#### Scenario: Mark group read
- **WHEN** the user chooses "Mark all as read" on `Homelab (12)`
- **THEN** the tab reads `Homelab`, its topics show no unread badge, and their open browser notifications close

#### Scenario: Other tabs untouched
- **WHEN** the user marks `Homelab` as read
- **THEN** unread messages of topics outside Homelab stay unread

### Requirement: Reorder group tabs
"Move left" and "Move right" SHALL swap a group tab with its neighbouring group tab and save the new order. They SHALL NOT move a group past `All` or `Ungrouped`.

#### Scenario: Move right
- **WHEN** tabs are `Homelab`, `DGSL` and the user chooses "Move right" on `Homelab`
- **THEN** the tabs read `DGSL`, `Homelab`, also after a reload

#### Scenario: Edge of the order
- **WHEN** the user opens the menu on the first group tab
- **THEN** "Move left" is disabled

### Requirement: Rename and delete a group
"Rename" SHALL change the group name for all its topics, keep its position in the tab order, and follow the name rules. "Delete" SHALL make all its topics ungrouped and remove the group from the tab order.

#### Scenario: Rename keeps position and default
- **WHEN** the default tab `Homelab` (second in order) is renamed to `Lab`
- **THEN** `Lab` is second, holds the same topics, and is still the default tab

#### Scenario: Delete
- **WHEN** the user deletes `DGSL`
- **THEN** its topics appear under `Ungrouped`, the `DGSL` tab disappears, and if it was the default the default becomes `All`

### Requirement: Default tab
"Open by default" SHALL save the tab (`All`, `Ungrouped` or a group) that is selected when the app starts. With no saved default, `All` SHALL open. A saved default that no longer exists SHALL fall back to `All`, but only after the subscription list has finished loading.

#### Scenario: Default opens at start
- **WHEN** `Homelab` is the default and the user opens the app
- **THEN** the `Homelab` tab is selected

#### Scenario: Default survives slow load
- **WHEN** the app starts and the subscription list is still loading
- **THEN** the saved default is kept, and `Homelab` is selected once the list loads

#### Scenario: Missing default falls back
- **WHEN** the saved default group no longer exists after the subscription list has loaded
- **THEN** `All` is selected and becomes the saved default

### Requirement: Groups stay in sync across open windows
Group changes made in one browser tab or window SHALL appear in the other open tabs and windows of the same app and user without a reload.

#### Scenario: Two windows
- **WHEN** the user moves a topic to "Homelab" in one window
- **THEN** a second open window shows it under "Homelab" without a reload
