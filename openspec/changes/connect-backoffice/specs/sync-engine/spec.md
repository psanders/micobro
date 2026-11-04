# Spec Delta

## ADDED Requirements

### Requirement: Push targets the back office while connected

While the device is connected to a back office, every push this capability
describes (after a change, on reconnect, "Sincronizar ahora") SHALL go to
the back office instead of the Google Sheet, under the same single-flight,
silent-automatic and retry-cap rules. Nothing SHALL be pushed to the Sheet.

#### Scenario: Cobro while connected to the back office

- **WHEN** a connected lender records a cobro while online
- **THEN** the app pushes it to the back office right away and writes nothing to the Google Sheet

#### Scenario: Not connected

- **WHEN** the device has never connected to a back office
- **THEN** pushes go to the Google Sheet exactly as before
