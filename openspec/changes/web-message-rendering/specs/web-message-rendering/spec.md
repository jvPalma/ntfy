# Spec Delta

## Purpose

Defines how the web app renders a notification's body and card: Markdown features, code highlighting and copying, URL safety, fonts and card text sizes.

## ADDED Requirements

### Requirement: Markdown tables
A message sent as Markdown SHALL render GitHub-flavoured tables as HTML tables with visible cell borders and padding. A table wider than the card SHALL scroll horizontally inside the card without widening the page.

#### Scenario: Table renders
- **WHEN** a message with `Content-Type: text/markdown` contains `| a | b |\n|---|---|\n| 1 | 2 |`
- **THEN** the card shows a table with header cells "a" and "b" and one row "1", "2"

#### Scenario: Wide table scrolls inside the card
- **WHEN** a Markdown table is wider than the card at a 390 px viewport
- **THEN** the table scrolls horizontally inside the card and the page has no horizontal scrollbar

#### Scenario: Plain-text message is unchanged
- **WHEN** a message without Markdown content type contains pipe characters
- **THEN** the pipes are shown as text, not as a table

### Requirement: Code highlighting in Monokai Night
A fenced code block whose fence names a supported language or alias SHALL be coloured with the Monokai Night palette (background `#1F1F1F`, text `#DDDDDD`, token colours from `HANDOFF-android-fork.md` §3.2) in both the light and the dark theme. Supported: bash, javascript, typescript, markup (html, xml, svg), python, kotlin, yaml, go, csharp, cpp, markdown, json, and the handoff's aliases.

#### Scenario: Bash block is coloured
- **WHEN** a Markdown message contains a ```` ```bash ```` block with `# note` and `echo "hi"`
- **THEN** `# note` is shown in `#75715E` and `"hi"` in `#E6DB74` on a `#1F1F1F` background

#### Scenario: Alias resolves
- **WHEN** the fence names `sh`, `zsh`, `ts`, `yml`, `py`, `golang` or `html`
- **THEN** the block is coloured as bash, typescript, yaml, python, go or markup respectively

#### Scenario: Same palette in the light theme
- **WHEN** the app is in the light theme and a highlighted block is shown
- **THEN** the block keeps the `#1F1F1F` background and the same token colours as in the dark theme

#### Scenario: Unknown or missing language
- **WHEN** the fence names no language or a language outside the supported list
- **THEN** the block is shown with the Monokai Night background and default text colour, without token colours, and without an error

### Requirement: Highlighting does not slow down other messages
The highlighting code SHALL be downloaded only when a code block with a supported language is shown. A code block longer than 20,000 characters SHALL be shown unhighlighted.

#### Scenario: No code, no highlighter download
- **WHEN** the user opens a topic whose messages contain no fenced code block with a supported language
- **THEN** the browser does not request the highlighter chunk

#### Scenario: Oversized block is not highlighted
- **WHEN** a fenced `bash` block has more than 20,000 characters
- **THEN** it is shown in the default code colour on the Monokai Night background and the page stays responsive

### Requirement: Copy button on code blocks
Every fenced code block in a Markdown message SHALL show a button labelled "󰆏 copy" (Nerd Font icon U+F018F) at its top right, in link colour at 85 % of the code size. The button SHALL be keyboard-focusable and have an accessible name.

#### Scenario: Button is present and focusable
- **WHEN** a Markdown message with one fenced code block is shown
- **THEN** the block shows one copy button at its top right, reachable with Tab, with the accessible name "Copy code"

#### Scenario: Highlighting survives the button
- **WHEN** a highlighted block with a copy button is shown
- **THEN** the token colours are unchanged compared with the same block's highlighting

### Requirement: Copy button copies only the code
Activating the copy button SHALL put exactly the block's code text on the clipboard (no fence, no language name, no trailing newline added), SHALL show "󰄬 copied" on the button for 2 seconds, and SHALL NOT trigger any other card action.

#### Scenario: Successful copy
- **WHEN** the user clicks the copy button of a block containing `echo "hi"`
- **THEN** the clipboard holds `echo "hi"` and the button reads "󰄬 copied" for 2 seconds, then "󰆏 copy" again

#### Scenario: Click does not reach the card
- **WHEN** the user clicks the copy button
- **THEN** no other handler on the card runs and the "Copied to clipboard" message toast for the card is not shown

#### Scenario: Clipboard failure
- **WHEN** writing to the clipboard fails
- **THEN** a toast "Could not copy code" is shown and the button label stays "󰆏 copy"

### Requirement: Markdown stays safe
Links and images in Markdown SHALL pass through the existing URL sanitiser, so unsafe protocols (for example `javascript:` and `data:`) are removed. Raw HTML in a Markdown message SHALL NOT be rendered as HTML.

#### Scenario: Unsafe link is neutralised
- **WHEN** a Markdown message contains `[x](javascript:alert(1))`
- **THEN** the link has an empty `href` and no script runs

#### Scenario: Raw HTML is inert
- **WHEN** a Markdown message contains `<img src=x onerror=alert(1)>`
- **THEN** no `img` element is created from it and no script runs

#### Scenario: Code text is not interpreted as HTML
- **WHEN** a highlighted `markup` block contains `<script>alert(1)</script>`
- **THEN** the text is shown literally and no script runs

### Requirement: App fonts
All UI text SHALL use IBM Plex Sans. Code (inline and blocks), message dates and unread counters SHALL use JetBrains Mono Nerd Font, so Nerd Font icons render. Both fonts SHALL be served from the ntfy server itself and SHALL be available when the installed PWA starts offline.

#### Scenario: Fonts applied
- **WHEN** the topic view is shown
- **THEN** the message body computes to the IBM Plex Sans family and the message date and the sidebar unread counter compute to the JetBrains Mono Nerd Font family

#### Scenario: No third-party font request
- **WHEN** the app loads
- **THEN** every font request goes to the ntfy server origin

#### Scenario: Offline PWA keeps fonts
- **WHEN** the installed PWA has been opened once online and is then started offline
- **THEN** text renders in IBM Plex Sans and JetBrains Mono Nerd Font, not a fallback font

### Requirement: Compact message cards
Message card text SHALL be 80 % of the web app's previous size: body, title, date, tags, attachment info and action-button labels. Inline and block code SHALL keep the Android ratio of code to body text (12.5 / 14.4). All these sizes SHALL be defined in one place.

#### Scenario: Body and date sizes
- **WHEN** a message card is shown at default browser zoom
- **THEN** the body text computes to 12.8 px (was 16 px) and the date to 11.2 px (was 14 px)

#### Scenario: Other card text follows the same ratio
- **WHEN** a card with a title, tags, an attachment and action buttons is shown
- **THEN** each of these texts computes to 80 % of its previous size
