# feedback-report

## Purpose

The in-app feedback flow — consent, screen-recording capture, and
submission — that lets a lender report a bug or request straight from the
app, on both Android and iOS.

## Requirements

### Requirement: Consent before recording

Enviar feedback SHALL first show a consent screen explaining that the
screen will be recorded, before any recording starts. Applies on both
platforms.

#### Scenario: Consent shown first

- **WHEN** the user taps Enviar feedback
- **THEN** the consent screen appears and no recording has started yet

### Requirement: Recording overlay

Once the user confirms, the app SHALL show a recording-in-progress
indicator over whatever screen the user navigates to, with an option to
stop and an option to discard. On Android, recording is device-wide
(MediaProjection has no in-app-only mode) and continues if the lender
leaves the app. On iOS, recording is scoped to Micobro's own screens
(in-app capture, not ReplayKit's global/broadcast API) and stops if the
lender backgrounds the app mid-capture — an expected, acceptable
difference for feedback about something inside the app.

#### Scenario: Discard cancels cleanly

- **WHEN** the user discards a recording in progress
- **THEN** recording stops, nothing is submitted, and the app returns to its prior state

#### Scenario: iOS recording is scoped to the app

- **WHEN** a lender on iOS backgrounds Micobro while a feedback recording is in progress
- **THEN** the recording stops, matching the platform's in-app capture scope

### Requirement: Sending state

Stopping the recording SHALL move to a sending screen while the feedback
is submitted.

#### Scenario: Submission in progress

- **WHEN** the user stops the recording
- **THEN** a sending screen shows until the submission settles

### Requirement: Sent and error outcomes

A successful submission SHALL show a "sent" confirmation with a Cerrar
action. A failed submission SHALL show an error screen with retry and
close actions, using the same Spanish message on both platforms rather
than a raw native error.

#### Scenario: Successful submission

- **WHEN** the submission resolves successfully
- **THEN** the sent confirmation screen shows

#### Scenario: Failed submission

- **WHEN** the submission fails (including a declined recording or
  microphone permission)
- **THEN** an error screen shows a Spanish message with retry and close options, identical on both platforms

### Requirement: Submission is stubbed pending an auth decision

`FeedbackRepo.submit()` SHALL accept the recorded feedback and resolve
successfully without transmitting it anywhere, until a per-lender
authentication approach to `github.com/psanders/micobro` is chosen (no
shared secret is embedded in the app).

#### Scenario: Mock submit always succeeds

- **WHEN** a recording is submitted in the current build
- **THEN** the repo resolves success without a network call, and the sent screen shows
