# cash-close

## Purpose

The caja (cash-on-hand) domain: a system-computed total derived from every
payment (any method) recorded since the lender's last close — not a
persisted running counter, computed fresh from source tables like every
other rolling number in this app. Closing is match-gated against a
manually-verified total and records an immutable ledger entry for the
reconciled period, syncing to a dedicated Sheet tab.

## Requirements

### Requirement: Caja total accumulates across days without a forced daily reset

The app SHALL maintain a system-computed caja total equal to the sum of all payments (any method — cash and transfers both count) recorded since the last close, or since the beginning if no close has ever happened. This total SHALL NOT reset automatically at the end of a day.

#### Scenario: Total accumulates across multiple days

- **WHEN** the lender collects payments over several days without ever closing the caja
- **THEN** the caja total equals the sum of all of those payments, undiminished by the passage of days

#### Scenario: Transfers count toward the caja total

- **WHEN** a payment is recorded with method "transfer"
- **THEN** it is included in the caja total, the same as a cash payment

### Requirement: Closing requires the verified total to match the system total

The app SHALL let the lender submit a manually-verified total to close the caja. Closing SHALL be rejected — no ledger entry created, no state changed — if the verified total does not exactly match the current system-computed caja total.

#### Scenario: Matching totals allow the close

- **WHEN** the lender submits a verified total equal to the current system-computed caja total
- **THEN** the close succeeds

#### Scenario: Mismatched totals block the close

- **WHEN** the lender submits a verified total that differs from the current system-computed caja total
- **THEN** the close is rejected and no ledger entry is created

### Requirement: Closing records a ledger entry for the reconciled period and resets the total

A successful close SHALL write a new ledger entry recording the reconciled amount and the period it covers (from the previous close's timestamp, or the beginning if none exists, through the closing moment). After a close, the caja total SHALL read as 0 (i.e., only payments recorded after this close count toward the next total).

#### Scenario: Closing records the accumulated total and period

- **WHEN** the lender has accounted for RD$2,000 since the last close and successfully closes the caja
- **THEN** a ledger entry is created for RD$2,000 covering the period from the previous close to now, and the caja total immediately reads RD$0

#### Scenario: A later close only covers what accumulated since the previous one

- **WHEN** the lender closes the caja, then later collects more payments and closes again
- **THEN** the second ledger entry's amount and period reflect only what accumulated after the first close, not the first close's already-recorded period

### Requirement: Closing with a zero total is unavailable

The app SHALL NOT allow closing the caja when the current system-computed total is 0 — there is nothing to record.

#### Scenario: Close action is unavailable at zero total

- **WHEN** the caja total is 0
- **THEN** the close action is disabled and no ledger entry can be created

### Requirement: Cash closes sync to a dedicated Sheet tab

Each caja close SHALL be queued for sync the same way other local writes are, and SHALL be written to a dedicated "Cierres" tab in the lender's Google Sheet, provisioned automatically like the app's other entity tabs.

#### Scenario: A close appears in the Cierres tab after sync

- **WHEN** the lender closes the caja while online (or later reconnects)
- **THEN** a corresponding row appears in the "Cierres" tab of the lender's Datos spreadsheet, including the period it covers
