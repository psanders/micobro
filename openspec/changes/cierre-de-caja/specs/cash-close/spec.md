## ADDED Requirements

### Requirement: Caja balance accumulates across days without a forced daily reset

The app SHALL maintain a caja (cash-on-hand) balance equal to the sum of all cash-only payments (excluding transfers) recorded since the last close, or since the beginning if no close has ever happened. This balance SHALL NOT reset automatically at the end of a day.

#### Scenario: Balance accumulates across multiple days

- **WHEN** the lender collects cash payments over several days without ever closing the caja
- **THEN** the caja balance equals the sum of all of those cash payments, undiminished by the passage of days

#### Scenario: Transfers do not count toward the caja balance

- **WHEN** a payment is recorded with method "transfer"
- **THEN** it is excluded from the caja balance

### Requirement: Closing the caja records a ledger entry and resets the balance

The app SHALL let the lender explicitly close the caja. Closing SHALL write a new ledger entry recording the current accumulated balance and the closing date/time, after which the caja balance SHALL read as 0 (i.e., only cash payments recorded after this close count toward the next balance).

#### Scenario: Closing records the accumulated total

- **WHEN** the lender has collected RD$2,000 in cash since the last close and closes the caja
- **THEN** a ledger entry is created for RD$2,000 with the current date/time, and the caja balance immediately reads RD$0

#### Scenario: A later close only counts what accumulated since the previous one

- **WHEN** the lender closes the caja, then later collects more cash payments and closes again
- **THEN** the second ledger entry's amount reflects only the cash collected after the first close, not the first close's already-recorded amount

### Requirement: Closing with a zero balance is a no-op

The app SHALL NOT allow closing the caja when the current balance is 0 — there is nothing to record.

#### Scenario: Close action is unavailable at zero balance

- **WHEN** the caja balance is 0
- **THEN** the "Cerrar caja" action is disabled and no ledger entry can be created

### Requirement: Cash closes sync to a dedicated Sheet tab

Each caja close SHALL be queued for sync the same way other local writes are, and SHALL be written to a dedicated "Cierres" tab in the lender's Google Sheet, provisioned automatically like the app's other entity tabs.

#### Scenario: A close appears in the Cierres tab after sync

- **WHEN** the lender closes the caja while online (or later reconnects)
- **THEN** a corresponding row appears in the "Cierres" tab of the lender's Datos spreadsheet
