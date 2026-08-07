## MODIFIED Requirements

### Requirement: Open-credit loan detail

For an open-credit loan, the detail screen SHALL show the current **Capital
pendiente** (outstanding balance), the interest for the current cycle under the
label **Interés del próximo pago**, the next payment date, and a **Historial de
ciclos** listing each cycle with its interest and status — instead of a fixed
cuota schedule. The balance, interest, and cycle history are derived from the
capital, the per-cycle rate, the cycle frecuencia, and the recorded payments;
there is no fixed end date.

The interest figure SHALL NOT be labelled "pendiente" nor styled with the
overdue/mora colour: while a cycle is in progress that interest is not owed
yet, it is what the next payment will cost, and both the wording and the colour
must say so.

#### Scenario: Interest-only cycles hold the balance

- **WHEN** an open-credit loan of RD$10,000 at 5% per cycle has two cycles paid
  interest-only (RD$500 each)
- **THEN** Capital pendiente is still RD$10,000 and Interés del próximo pago is
  RD$500, and the Historial shows two interest-only cycles

#### Scenario: A capital payment lowers the balance and next interest

- **WHEN** a cycle is paid RD$500 interest plus RD$2,000 capital
- **THEN** Capital pendiente drops to RD$8,000 and the next cycle's Interés del
  próximo pago becomes RD$400 (5% of 8,000)

#### Scenario: A skipped cycle capitalizes its interest

- **WHEN** a cycle passes with no payment on an RD$10,000 / 5% loan
- **THEN** the RD$500 unpaid interest is added to the balance (RD$10,500) and
  the cycle shows as skipped/capitalized, with no separate mora charged

#### Scenario: The interest is not presented as owed

- **WHEN** an open-credit loan's current cycle is still in progress
- **THEN** the interest is labelled "Interés del próximo pago" and rendered in
  a neutral colour, not the colour used for mora or skipped cycles
