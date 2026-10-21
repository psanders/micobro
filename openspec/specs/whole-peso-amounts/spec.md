# whole-peso-amounts Specification

## Purpose

Every monetary amount the lender enters, sees or prints is a whole peso: computed amounts (interest, mora, crédito abierto interest) round to the nearest peso at the source, typed amounts with centavos are rejected, and displays and receipts never show decimals. Storage and sync keep cents.

## Requirements

### Requirement: Computed amounts are whole pesos

Every amount the app computes — flat interest, total to repay, mora, crédito abierto interest and the balances derived from them — SHALL be rounded to the nearest whole peso (halves round up) at the moment it is computed, so that no amount in the app ever carries centavos and displayed figures always add up.

#### Scenario: Flat interest rounds to the peso

- **WHEN** a loan of RD$5,000 at 12.5% flat interest is configured
- **THEN** its interest is RD$625 and its total to repay is RD$5,625

#### Scenario: Fractional interest rounds to the nearest peso

- **WHEN** a loan of RD$1,001 at 12.5% flat interest is configured
- **THEN** its interest is RD$125 (125.125 rounded) and its total to repay is RD$1,126

#### Scenario: Mora rounds to the peso

- **WHEN** a cuota of RD$1,105 is 10 days late under a mora rate that yields RD$36.83
- **THEN** the mora shown and charged is RD$37

#### Scenario: Crédito abierto interest rounds to the peso

- **WHEN** a crédito abierto balance of RD$10,333 accrues a 10% cycle
- **THEN** the cycle's interest is RD$1,033 and the next balance is calculated from that whole-peso amount

### Requirement: Entered amounts are whole pesos

Amount inputs (principal, payment, custom payment, capital paydown, promised amount, cash verified) SHALL accept whole pesos only, tolerating thousands separators and the "RD$" prefix. A value with a decimal part SHALL be rejected with a Spanish message asking for a whole-peso amount, and SHALL NOT be rounded silently.

#### Scenario: Whole amount with separators

- **WHEN** the lender types "1,105" or "RD$ 1,105"
- **THEN** the amount is RD$1,105

#### Scenario: Decimal amount is rejected

- **WHEN** the lender types "1105.50" or "1105,50" as a payment
- **THEN** the amount is not accepted and the field explains that only whole pesos are allowed

### Requirement: Amounts display without decimals

Every amount shown on screen, in lists and in the printed receipt SHALL appear as whole pesos with thousands separators and no decimals (for example "RD$18,240"), through one shared formatting path.

#### Scenario: Payment history total

- **WHEN** the lender opens the payment history
- **THEN** the collected total is shown as a whole-peso amount such as "RD$18,240"

#### Scenario: Printed receipt

- **WHEN** a receipt is printed for a payment of RD$1,105
- **THEN** the receipt shows "RD$1,105" and no ".00"

### Requirement: Sync keeps stored values

Rounding SHALL NOT alter how amounts are stored or synced: amounts remain stored as cents that are always multiples of 100, and the Google Sheet receives the stored value unchanged.

#### Scenario: Syncing a payment

- **WHEN** a RD$1,105 payment is synced
- **THEN** the sheet receives the same stored value it received before this change
