## ADDED Requirements

### Requirement: Erase my data from Mi cuenta

Mi cuenta SHALL offer "Eliminar mis datos". Choosing it SHALL first show a confirmation that lists what is erased (customers, loans, payments, visits, cash closes, profile and PIN), states that Google is disconnected, that the «Micobro / Datos» sheet in the lender's Google Drive is not deleted, and that it cannot be undone.

#### Scenario: Cancel at the confirmation

- **WHEN** the lender taps "Eliminar mis datos" and then "Cancelar"
- **THEN** nothing is erased and Mi cuenta stays open

### Requirement: The PIN is required

After confirming, the app SHALL ask for the current PIN and SHALL erase nothing unless the PIN is correct. A wrong PIN SHALL show "PIN incorrecto. Intenta de nuevo." and allow another try; "Cancelar" SHALL return without erasing.

#### Scenario: Wrong PIN

- **WHEN** the lender enters a PIN that doesn't match
- **THEN** the screen says the PIN is incorrect and all data is still on the phone

#### Scenario: Malformed PIN

- **WHEN** erasing is requested with a PIN that isn't four digits
- **THEN** it is rejected as invalid before the PIN is checked or anything is erased

### Requirement: Erasing leaves a fresh install

With the correct PIN the app SHALL delete every customer, loan, payment, visit, cash close, pending sync change, sync record and the profile from the phone, clear the app's stored settings and the PIN, sign out of Google, and return to first-run onboarding ("Crea tu PIN"). A failed Google sign-out SHALL NOT stop the erase.

#### Scenario: Correct PIN

- **WHEN** the lender enters the correct PIN
- **THEN** all local data, settings and the PIN are erased, Google is disconnected, and the app shows "Crea tu PIN"

#### Scenario: Offline or never connected to Google

- **WHEN** signing out of Google fails during the erase
- **THEN** the erase still completes

### Requirement: The Drive backup is untouched

Erasing SHALL NOT delete or modify the lender's «Micobro / Datos» spreadsheet in Google Drive.

#### Scenario: Lender with a backup

- **WHEN** a connected lender erases their data
- **THEN** their Drive sheet still exists with its last synced contents
