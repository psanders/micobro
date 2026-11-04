# Spec Delta

## ADDED Requirements

### Requirement: No Sheet pull while connected to the back office

While the device is connected to a back office, the app SHALL NOT pull from
the Google Sheet, neither after "Sincronizar ahora" nor on the automatic
open-time sync. Edits made in the Sheet after connecting SHALL NOT reach
the app.

#### Scenario: Manual sync while connected

- **WHEN** a connected lender taps "Sincronizar ahora"
- **THEN** the app pushes to the back office and does not read the Google Sheet
