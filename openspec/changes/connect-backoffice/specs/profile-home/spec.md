# Spec Delta

## ADDED Requirements

### Requirement: Backup pill shows the back office connection

While the device is connected to a back office, the Perfil backup-status
pill SHALL name the back office connection (for example "Back office
conectado") with how long ago it last synced, instead of the Google Sheet
status. It SHALL show when changes need attention.

#### Scenario: Connected and synced

- **WHEN** a connected lender opens Perfil after a successful sync
- **THEN** the pill shows the back office connection and how long ago it synced

#### Scenario: Changes need attention

- **WHEN** a connected lender has changes under "Necesita atención"
- **THEN** the pill shows that something needs attention
