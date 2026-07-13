# google-connect (delta)

## MODIFIED Requirements

### Requirement: Google connect re-entry from Settings

The Conectar con Google screen SHALL be reachable after onboarding from the
settings screen (opened via the Home screen's avatar button) while
disconnected. In that context, connect success and the close/skip actions
SHALL return to the previous screen instead of completing onboarding.

#### Scenario: Re-entry returns on close

- **WHEN** the user opens Conectar from the settings screen and taps the header X or the skip link
- **THEN** the app navigates back to settings without changing sync state
