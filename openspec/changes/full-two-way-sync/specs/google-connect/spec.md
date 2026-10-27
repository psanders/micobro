# Spec Delta

## ADDED Requirements

### Requirement: The id column and header row are protected with a warning

On every connect, provisioning SHALL ensure the header row and the id column of each synced tab (`Clientes`, `Préstamos`, `Pagos`, `Visitas`, `Cierres`) have a warning-only protection, adding it to tabs that lack it. Editing those cells SHALL still be possible after the warning. Existing protections and other tabs SHALL NOT be changed.

#### Scenario: A new spreadsheet is protected

- **WHEN** a lender connects for the first time and the `Datos` spreadsheet is provisioned
- **THEN** each synced tab's header row and id column show a warning before they are edited in Google Sheets

#### Scenario: An existing spreadsheet gets the protection on reconnect

- **WHEN** a lender whose spreadsheet was provisioned before this change connects again
- **THEN** the warning-only protection is added to each synced tab, and no data or other tab is changed

#### Scenario: Protection is not duplicated

- **WHEN** a tab already has the app's protection and the lender connects again
- **THEN** no second protection is added to that tab

#### Scenario: Owners can still edit after the warning

- **WHEN** the owner confirms the warning and edits an id cell
- **THEN** Google Sheets accepts the edit
