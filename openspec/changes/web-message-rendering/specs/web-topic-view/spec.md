# Spec Delta

## Purpose

Defines the order and scroll behaviour of the message list inside a single topic in the web app, so a topic reads like a chat.

## ADDED Requirements

### Requirement: Chat order inside a topic
Inside a single topic, messages SHALL be listed oldest at the top and newest at the bottom. The "All notifications" view SHALL keep newest at the top.

#### Scenario: Topic in chat order
- **WHEN** a topic has messages A (oldest), B and C (newest) and the user opens it
- **THEN** the list shows A, B, C from top to bottom

#### Scenario: All notifications unchanged
- **WHEN** the user opens "All notifications"
- **THEN** the newest message is at the top

### Requirement: Topic opens at the newest message
Opening a topic, or switching to another topic, SHALL show the bottom of the list, with the newest message fully visible above the message bar. The view SHALL stay at the bottom while images and Markdown above finish loading, until the user scrolls.

#### Scenario: Opens at the bottom
- **WHEN** the user opens a topic with 50 messages
- **THEN** the newest message is visible and fully above the message bar, without the user scrolling

#### Scenario: Late-loading content does not push the newest message away
- **WHEN** an image attachment above the newest message finishes loading after the topic opened
- **THEN** the newest message is still fully visible at the bottom

#### Scenario: Topic with one message
- **WHEN** the user opens a topic with one message
- **THEN** the message is shown and no history loading is triggered

### Requirement: Older messages load at the top
Scrolling near the top of a topic SHALL load the next page of older messages above the current ones. The message the user was looking at SHALL stay at the same position on screen after the older messages are inserted.

#### Scenario: Loading history keeps the reading position
- **WHEN** a topic has 100 messages, the user scrolls to the top of the first 20 shown, and older messages are loaded
- **THEN** older messages appear above, and the message that was at the top of the screen before loading is still at the same position

#### Scenario: Whole history reachable
- **WHEN** the user keeps scrolling up in a topic with 100 messages
- **THEN** the oldest message is eventually shown at the top and no further loading is triggered

### Requirement: New messages scroll into view
When a new message arrives in the open topic, the list SHALL scroll to the bottom so the new message is fully visible, also when the user had scrolled up into history (the behaviour approved on the Android fork).

#### Scenario: New message while at the bottom
- **WHEN** the user is at the bottom of a topic and a new message arrives
- **THEN** the new message appears at the bottom and is fully visible

#### Scenario: New message while reading history
- **WHEN** the user has scrolled up in a topic and a new message arrives
- **THEN** the list scrolls to the bottom and the new message is fully visible
