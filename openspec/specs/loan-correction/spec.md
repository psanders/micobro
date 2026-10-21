# loan-correction Specification

## Purpose

Correcting a loan: edit the terms of a loan with no payments, lock them once payments exist, archive and restore any loan, keep an archived loan's collected money in the history and the caja, create a corrected loan from an archived one, and sync every correction the same with or without Google Sheets.

## Requirements

### Requirement: Edit a loan that has no payments

A loan with no payments recorded against it SHALL be editable through "Editar préstamo", which opens the new-loan form prefilled with the loan's current principal, number of cuotas, interest rate, frequency, first payment date, mora settings and loan type. The customer SHALL NOT be editable. Saving SHALL validate the terms with the same rules as creating a loan, keep the loan's id and code, and recompute its schedule, totals and next due date from the new terms everywhere the loan appears.

#### Scenario: Correcting the number of cuotas

- **WHEN** a lender opens Editar préstamo on a payment-free 12-cuota loan, changes it to 10 cuotas and saves
- **THEN** the loan detail shows 10 cuotas with the cuota amount recomputed, and the loan keeps the same code

#### Scenario: Correcting the principal

- **WHEN** a lender changes a payment-free loan's principal from RD$15,000 to RD$10,000 and saves
- **THEN** the balance, total a pagar and every cuota reflect RD$10,000

#### Scenario: Invalid edit is rejected

- **WHEN** a lender clears the principal or enters 0 cuotas and taps save
- **THEN** the form shows the same Spanish validation error as when creating a loan and nothing is saved

#### Scenario: Visits do not block editing

- **WHEN** a payment-free loan has visits recorded against it
- **THEN** Editar préstamo is still available

### Requirement: Payments lock a loan's terms

Once at least one payment is recorded against a loan, its terms SHALL NOT be editable from the app; "Editar préstamo" SHALL be shown disabled with the reason (the loan already has payments) and a pointer to archive it and create a corrected one. Saving an edit to a loan with payments SHALL be rejected even if attempted outside the menu. This applies to term and open-credit (crédito abierto) loans alike.

#### Scenario: Loan with a payment

- **WHEN** a lender opens the ⋮ menu on a loan with one recorded payment
- **THEN** Editar préstamo is disabled with the reason shown, and Archivar préstamo is available

#### Scenario: Open-credit loan with an interest payment

- **WHEN** an open-credit loan has an interest payment recorded
- **THEN** it can no longer be edited, only archived

### Requirement: Archive a loan

Any loan that is not archived SHALL be archivable through "Archivar préstamo" after a confirmation. Archiving SHALL change the loan's status to archived without deleting it or any of its payments or visits. An archived loan SHALL NOT appear in Ruta, in Hoy's goal or upcoming visits, under "PRÉSTAMOS ACTIVOS", or in a customer's active-loan count.

#### Scenario: Archiving a mistaken loan

- **WHEN** a lender archives a loan and confirms
- **THEN** the loan leaves Ruta, Hoy and the customer's active loans, and appears under the customer's Archivados

#### Scenario: Cancelling the confirmation

- **WHEN** a lender taps Archivar préstamo and then cancels
- **THEN** the loan is unchanged

### Requirement: Archived loans keep their collected money

Payments on an archived loan SHALL remain in that loan's payment history and SHALL keep counting toward Cuadre de caja, because the money was collected.

#### Scenario: Archiving after collecting

- **WHEN** a lender collects RD$553 on a loan and then archives it before closing the caja
- **THEN** Cuadre de caja still shows RD$553 collected and lists the receipt

### Requirement: Create a corrected loan from an archived one

When the loan being archived has payments and still has an outstanding balance, the archive confirmation SHALL offer "Crear préstamo corregido". A fully paid loan (no balance left, or a closed crédito abierto) has nothing to correct: its confirmation SHALL only offer to archive it or cancel. Choosing it SHALL archive the loan and open the new-loan form for the same customer prefilled with the archived loan's terms. The new loan SHALL be independent: the archived loan's payments SHALL NOT move to it.

#### Scenario: Replacing a loan that already has payments

- **WHEN** a lender archives a loan with payments and chooses Crear préstamo corregido
- **THEN** the loan is archived and the new-loan form opens for the same customer with its principal, cuotas, rate and frequency prefilled

#### Scenario: Archiving a fully paid loan

- **WHEN** a lender archives a loan whose balance is fully paid
- **THEN** the confirmation offers only Archivar préstamo and Cancelar, with no Crear préstamo corregido

#### Scenario: Backing out of the corrected loan

- **WHEN** the lender leaves the prefilled form without saving
- **THEN** the original loan stays archived and no new loan is created

### Requirement: Restore an archived loan

An archived loan SHALL offer "Restaurar", which returns it to active so it reappears everywhere active loans appear, with its schedule and payments unchanged.

#### Scenario: Undoing a mistaken archive

- **WHEN** a lender opens an archived loan and taps Restaurar
- **THEN** the loan is active again, shows under PRÉSTAMOS ACTIVOS, and its payments and schedule are as before

### Requirement: Corrections sync the same with or without Google Sheets

Editing, archiving and restoring SHALL save on the device immediately, work offline and without a connected Google account, and be queued for sync like every other change. When the lender is connected, the loan's existing row in the Sheet SHALL be corrected in place rather than duplicated. When the lender connects Google later, the Sheet SHALL end up with the loan's latest terms and status.

#### Scenario: Lender without Google Sheets

- **WHEN** a lender with no connected Google account edits or archives a loan
- **THEN** the change takes effect in the app immediately and no error is shown

#### Scenario: Connected lender edits a loan

- **WHEN** a connected lender edits a payment-free loan's principal and sync runs
- **THEN** that loan's row in the Préstamos tab shows the new principal and no second row is added

#### Scenario: Connecting after correcting

- **WHEN** a lender edits and then archives a loan, and only afterwards connects Google
- **THEN** the Sheet's row for that loan shows the edited terms and the archived status

#### Scenario: Archive is not undone by a pull

- **WHEN** a connected lender archives a loan and the next sync pulls the Sheet
- **THEN** the loan stays archived
