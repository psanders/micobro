# Spec Delta

## Purpose

Keeps on-device copies of the local database taken before each full sync, so
the owner can undo a sync that changed or deleted data they wanted to keep.

## ADDED Requirements

### Requirement: Each full sync saves a backup first

Before a manual or automatic full sync (backup, push, pull) changes anything, the app SHALL save a complete copy of the local database on the device. The push-only sync that runs after a local change or on reconnect SHALL NOT save a backup.

#### Scenario: Manual sync saves a backup

- **WHEN** the lender taps "Sincronizar ahora"
- **THEN** a new backup dated with the current time exists on the device before any data is pushed or pulled

#### Scenario: A local change does not save a backup

- **WHEN** the lender records a payment and the app pushes it on its own
- **THEN** no new backup is saved

### Requirement: Only the last 5 backups are kept

The app SHALL keep at most 5 backups. When a new backup is saved and 5 already exist, the oldest SHALL be removed.

#### Scenario: The sixth backup replaces the oldest

- **WHEN** 5 backups exist and a new full sync runs
- **THEN** 5 backups exist afterward: the new one and the 4 most recent before it

### Requirement: Backups are listed in Copias de seguridad

The app SHALL provide a **Copias de seguridad** screen, reachable from Sincronización con Google, listing each backup by its date and time, newest first, with the number of customers, loans and payments it contains.

#### Scenario: The owner sees available backups

- **WHEN** the owner opens Copias de seguridad after three full syncs
- **THEN** three backups are listed, newest first, each with its date, time and record counts

#### Scenario: No backups yet

- **WHEN** the owner opens Copias de seguridad before any full sync has run
- **THEN** the screen says there are no backups yet and explains they are made at each sync

### Requirement: Restoring a backup requires confirmation and the PIN

Restoring a backup SHALL replace all local data with the backup's data. The app SHALL ask for confirmation, stating that changes made after that backup will be lost, and SHALL require the PIN before restoring.

#### Scenario: Cancelling leaves data untouched

- **WHEN** the owner chooses a backup and then cancels the confirmation or the PIN prompt
- **THEN** local data is unchanged

#### Scenario: Restoring brings back deleted data

- **WHEN** a sync deleted a customer and the owner restores the backup taken before that sync
- **THEN** the customer and their loans, payments and visits are back in the app

### Requirement: A restored backup is written back to the Sheet

After a restore, every restored customer, loan, payment and visit SHALL be queued as a pending change, so the next sync writes it to the Sheet (the app wins) instead of deleting it again. A sync SHALL be started right after the restore when online.

#### Scenario: The next sync repairs the Sheet

- **WHEN** the owner restores a backup and the app then syncs
- **THEN** rows that had been deleted in the Sheet are written back to it, and no restored row is deleted

#### Scenario: Restoring while offline

- **WHEN** the owner restores a backup with no connectivity
- **THEN** the data is restored locally and the restored rows stay pending until the next successful sync

### Requirement: Backups never leave the device

Backups SHALL be stored only on the device and SHALL be removed by "Eliminar mis datos".

#### Scenario: Erasing data removes backups

- **WHEN** the owner erases their data from Mi cuenta
- **THEN** no backup remains on the device
