# Spec Delta

## Purpose

Defines how the ntfy jv web app looks and which screens it offers: the DGSL neutral light and dark themes, the theme preference, the screens and entry points that exist, layout direction, and what the server exposes about the web bundle.

## ADDED Requirements

### Requirement: DGSL neutral palette in light and dark
The web app SHALL draw every surface, text, border and control colour from the DGSL design system's neutral light theme or neutral dark theme. No other palette is available.

#### Scenario: Light theme colours
- **WHEN** the light theme is active
- **THEN** the page background, cards, text and primary buttons use the DGSL neutral light values
- **AND** the `<html>` element carries `data-theme="light"` and no `dark` class

#### Scenario: Dark theme colours
- **WHEN** the dark theme is active
- **THEN** the page background, cards, text and primary buttons use the DGSL neutral dark values
- **AND** the `<html>` element carries `data-theme="dark"` and the `dark` class

### Requirement: Theme preference with System, Light and Dark
The web app SHALL offer the theme options System, Light and Dark in Settings. System SHALL follow the operating system's colour scheme and update when it changes. The choice SHALL persist across reloads.

#### Scenario: System follows the operating system
- **WHEN** the preference is System and the operating system switches from light to dark
- **THEN** the app switches to the dark theme without a reload

#### Scenario: Explicit choice persists
- **WHEN** the user selects Dark and reloads the page
- **THEN** the app opens in the dark theme

### Requirement: No wrong-theme flash on start
The web app SHALL apply the stored theme before the first paint, including on a cold start of the installed PWA.

#### Scenario: Dark preference on cold start
- **WHEN** the stored preference is Dark and the app is opened from a closed state
- **THEN** no light-themed frame is shown before the app renders

### Requirement: Toasts and browser chrome follow the theme
Transient notifications (toasts) and the browser `theme-color` SHALL use the active theme.

#### Scenario: Toast in dark theme
- **WHEN** the dark theme is active and the app shows a toast (for example after copying a message)
- **THEN** the toast uses the dark theme's popover surface and text colours

#### Scenario: Theme switch updates the browser colour
- **WHEN** the active theme changes
- **THEN** the `theme-color` meta value changes to the new theme's top-bar colour

### Requirement: Interface and code fonts
The web app SHALL render interface text in IBM Plex Sans. It SHALL render code, message dates and unread counters in JetBrains Mono Nerd Font, so that Nerd Font icons display.

#### Scenario: Code uses the mono font
- **WHEN** a message contains inline code or a code block
- **THEN** the code renders in JetBrains Mono Nerd Font

#### Scenario: Interface text uses the sans font
- **WHEN** any screen renders a heading, a label or body text
- **THEN** it renders in IBM Plex Sans

### Requirement: Mobile dialogs fill the screen
Below the small-screen breakpoint, a dialog that used to open full-screen on mobile SHALL open as a full-width bottom sheet. On larger screens it SHALL open as a centred dialog.

#### Scenario: Publish dialog on a phone
- **WHEN** the viewport is narrower than 768 px and the user opens the publish dialog
- **THEN** it opens as a sheet across the full width of the screen

#### Scenario: Publish dialog on desktop
- **WHEN** the viewport is 768 px or wider and the user opens the publish dialog
- **THEN** it opens as a centred dialog over a dimmed overlay

### Requirement: Accessible controls
Every interactive control SHALL be reachable by keyboard and SHALL carry an accessible name. Dialogs SHALL trap focus while open and return focus to their trigger when closed.

#### Scenario: Keyboard closes a dialog
- **WHEN** a dialog is open and the user presses Escape
- **THEN** the dialog closes and focus returns to the control that opened it

#### Scenario: Icon-only buttons are named
- **WHEN** a screen reader reaches an icon-only button (for example the subscription menu)
- **THEN** it announces the button's name

### Requirement: Card actions scroll horizontally
When the action buttons of a notification card do not fit the card's width, the action row SHALL scroll horizontally instead of wrapping or overflowing the card.

#### Scenario: Many actions on a phone
- **WHEN** a notification has more action buttons than fit on a 360 px wide screen
- **THEN** the buttons stay on one row that scrolls horizontally inside the card

### Requirement: Disabled-feature screens are absent
The web app SHALL NOT offer signup, password reset, email verification, plan upgrade or billing, topic reservations, account email addresses, or account phone numbers. Their routes and entry points SHALL be absent whatever the server's feature flags say.

#### Scenario: Signup route
- **WHEN** a user opens `/signup`
- **THEN** the app shows no signup form and falls back to its normal handling for unknown paths

#### Scenario: Server enables signup
- **WHEN** the server config reports `enable_signup: true`
- **THEN** the top bar and the login page show no "Sign up" link

#### Scenario: Server enables reservations
- **WHEN** the server config reports `enable_reservations: true`
- **THEN** the subscribe dialog, the subscription menu, Settings and Account show no reservation controls

#### Scenario: Account page sections
- **WHEN** a logged-in user opens Account
- **THEN** the page shows username, password change, account type, usage, access tokens and account deletion
- **AND** it shows no billing, upgrade, email or phone-number section

### Requirement: Remaining features keep their behaviour
Every feature not listed as removed SHALL keep its behaviour after the visual migration: login and logout, subscribing (including to another server), publishing with attachments, emoji and options, notification list actions, subscription menu actions, Settings, Account usage and access tokens, account deletion, the notification-permission alerts and the version-update banner.

#### Scenario: End-to-end suite
- **WHEN** the Playwright suite runs against the migrated app
- **THEN** every test for a remaining feature passes, with selectors updated but no assertion of behaviour removed

#### Scenario: Subscribe to another server
- **WHEN** the user enables "use another server" in the subscribe dialog
- **THEN** a text field offers the previously used server URLs as suggestions and accepts any typed URL

### Requirement: Left-to-right layout for every language
The web app SHALL lay out every language left to right. Languages written right to left SHALL stay selectable, with their translated strings shown in a left-to-right layout.

#### Scenario: Arabic selected
- **WHEN** the user selects a right-to-left language such as Arabic
- **THEN** the strings change to that language and the `<html>` element keeps `dir="ltr"`

### Requirement: No sourcemaps served
The web build SHALL NOT emit JavaScript or CSS sourcemaps. The server SHALL return no sourcemap for any web asset.

#### Scenario: Request for a map file
- **WHEN** a client requests any `*.map` path under `/static/` on the deployed server
- **THEN** the response is not a sourcemap (no 200 with sourcemap content)

#### Scenario: Built bundle
- **WHEN** the web app is built
- **THEN** the output contains no `.map` files and no `sourceMappingURL` comments

### Requirement: Build marker in Settings
The Settings page SHALL show, in its footer, the version and commit of the build the web app was produced by. It SHALL be visible to every user, logged in or not.

#### Scenario: Custom image
- **WHEN** the image was built with version `2.34.0-jv` and commit `abc1234`
- **THEN** the Settings footer shows `2.34.0-jv` and `abc1234`

#### Scenario: Development build
- **WHEN** the web app was built without version information (for example `npm start`)
- **THEN** the footer shows `dev` instead of failing or showing an empty value
