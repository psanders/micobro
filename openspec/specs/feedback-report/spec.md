# feedback-report

## Purpose

The in-app feedback flow — consent, screen-recording capture, and
submission — that lets a lender report a bug or request straight from the
app.

## Requirements

### Requirement: Consent before recording

Enviar feedback SHALL first show a consent screen explaining that the
screen will be recorded, before any recording starts. This applies on
**Android** only — see "Enviar feedback is unavailable on iOS" below.

#### Scenario: Consent shown first

- **WHEN** the user taps Enviar feedback on Android
- **THEN** the consent screen appears and no recording has started yet

### Requirement: Recording overlay

Once the user confirms, the app SHALL show a recording-in-progress
indicator over whatever screen the user navigates to, with an option to
stop and an option to discard. This applies on **Android** only, where
recording is device-wide (MediaProjection has no in-app-only mode) and
continues if the lender leaves the app.

#### Scenario: Discard cancels cleanly

- **WHEN** the user discards a recording in progress on Android
- **THEN** recording stops, nothing is submitted, and the app returns to its prior state

#### Scenario: Android capture is unchanged

- **WHEN** a lender on Android records feedback
- **THEN** device-wide capture behaves exactly as before this change

### Requirement: Sending state

Stopping the recording SHALL move to a sending screen while the feedback
is submitted.

#### Scenario: Submission in progress

- **WHEN** the user stops the recording
- **THEN** a sending screen shows until the submission settles

### Requirement: Sent and error outcomes

A successful submission SHALL show a "sent" confirmation with a Cerrar
action. A failed submission SHALL show an error screen with retry and
close actions, using a Spanish message rather than a raw native error.
This applies on **Android** only in this change.

#### Scenario: Successful submission

- **WHEN** the submission resolves successfully on Android
- **THEN** the sent confirmation screen shows

#### Scenario: Failed submission

- **WHEN** the submission fails on Android (including a declined recording permission)
- **THEN** an error screen shows a Spanish message with retry and close options

### Requirement: Enviar feedback is unavailable on iOS

Micobro has no feedback-capture path that does not depend on screen
recording — the consent screen's only action starts a recording, and there
is no text-only submission. Because iOS screen recording is not yet
implemented (tracked in
[issue #116](https://github.com/psanders/micobro/issues/116)), the "Enviar
feedback" entry point in the profile screen SHALL be disabled on iOS and
SHALL show a Spanish "no disponible todavía en iOS" message rather than
opening the consent screen. This is a full-feature no-op on iOS, not a
degraded recording mode — it SHALL NOT be presented to the lender as merely
"recording unavailable" once the entry point itself does not lead anywhere.

#### Scenario: iOS lender sees why feedback is unavailable

- **WHEN** a lender on iOS taps "Enviar feedback" in the profile screen
- **THEN** the app shows the Spanish "no disponible todavía en iOS" message instead of the recording consent screen

#### Scenario: Android is unaffected

- **WHEN** a lender on Android taps "Enviar feedback"
- **THEN** the existing consent → recording → submission flow is unchanged

### Requirement: Submission is stubbed pending an auth decision

`FeedbackRepo.submit()` SHALL accept the recorded feedback and resolve
successfully without transmitting it anywhere, until a per-lender
authentication approach to `github.com/psanders/micobro` is chosen (no
shared secret is embedded in the app).

#### Scenario: Mock submit always succeeds

- **WHEN** a recording is submitted in the current build
- **THEN** the repo resolves success without a network call, and the sent screen shows
