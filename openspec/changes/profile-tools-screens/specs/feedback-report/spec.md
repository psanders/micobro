## ADDED Requirements

### Requirement: Consent before recording

Enviar feedback SHALL first show a consent screen explaining that the
screen will be recorded, before any recording starts.

#### Scenario: Consent shown first

- **WHEN** the user taps Enviar feedback
- **THEN** the consent screen appears and no recording has started yet

### Requirement: Recording overlay

Once the user confirms, the app SHALL show a recording-in-progress
indicator over whatever screen the user navigates to, with an option to
stop and an option to discard.

#### Scenario: Discard cancels cleanly

- **WHEN** the user discards a recording in progress
- **THEN** recording stops, nothing is submitted, and the app returns to its prior state

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

#### Scenario: Successful submission

- **WHEN** the submission resolves successfully
- **THEN** the sent confirmation screen shows

#### Scenario: Failed submission

- **WHEN** the submission fails (including a declined recording permission)
- **THEN** an error screen shows a Spanish message with retry and close options

### Requirement: Submission is stubbed pending an auth decision

`FeedbackRepo.submit()` SHALL accept the recorded feedback and resolve
successfully without transmitting it anywhere, until a per-lender
authentication approach to `github.com/psanders/micobro` is chosen (no
shared secret is embedded in the app).

#### Scenario: Mock submit always succeeds

- **WHEN** a recording is submitted in the current build
- **THEN** the repo resolves success without a network call, and the sent screen shows
