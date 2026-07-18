# daily-reconciliation

## Purpose

The Cuadre General screen — reconciling the caja (cash-on-hand) for the
period since the lender's last close, not "today": the system-computed
total (all payment methods), a manually-verified total that must match it
to unlock closing, and a desglose of recibos/transferencias for that same
period.

## Requirements

### Requirement: Cuadre General shows the system-computed total since the last close

The Cuadre General screen SHALL show a prominent system-computed total — the sum of all payments (any method) recorded since the last close — along with the date/time of that last close (or an indication that none has happened yet).

#### Scenario: Total reflects the since-last-close period

- **WHEN** Cuadre General opens
- **THEN** the displayed total equals the sum of all payments recorded since the last close, regardless of payment method

### Requirement: Cuadre General requires a matching verified total to close

The screen SHALL let the lender enter a verified total and SHALL show a match/mismatch indicator comparing it to the system-computed total. The "Cerrar caja" action SHALL be disabled unless the verified total exactly matches the system-computed total.

#### Scenario: Verified total matches

- **WHEN** the entered verified total equals the system-computed total
- **THEN** a match indicator shows and "Cerrar caja" becomes enabled

#### Scenario: Verified total differs

- **WHEN** the entered verified total differs from the system-computed total
- **THEN** a mismatch indicator shows the difference and "Cerrar caja" stays disabled

### Requirement: Desglose

The screen SHALL show a breakdown of the recibos (count) and transferencias (total) recorded since the last close.

#### Scenario: Desglose reflects the since-last-close period

- **WHEN** payments (cash and/or transfer) have been recorded since the last close
- **THEN** the desglose shows the recibos count and the transferencias total separately, covering that period

### Requirement: Cerrar caja

The screen SHALL offer "Cerrar caja", enabled only when the verified total matches the system-computed total and the total is non-zero. Tapping it SHALL record the close and trigger a sync.

#### Scenario: Closing the caja

- **WHEN** the lender taps "Cerrar caja" while it is enabled
- **THEN** a ledger entry is recorded for the reconciled period and a sync push/pull runs

#### Scenario: Cerrar caja is disabled when totals don't match or total is zero

- **WHEN** the verified total doesn't match the system-computed total, or the system-computed total is 0
- **THEN** "Cerrar caja" is disabled and tapping it has no effect
