## ADDED Requirements

### Requirement: Collect an open-credit payment

For an open-credit loan, the cobrar screen SHALL present the current cycle's
Interés pendiente and two payment options — **Solo interés** (pay exactly the
cycle interest, capital unchanged) and **Interés + capital** (pay the interest
plus a lender-entered capital amount) — with a "Después del pago" preview of the
resulting Capital restante and next Interés. Recording the payment stores an
ordinary amount+date row; when the payment brings the capital balance to zero
the loan is marked paid/finished.

#### Scenario: Solo interés

- **WHEN** the lender collects "Solo interés" on an RD$10,000 / 5% loan
- **THEN** RD$500 is recorded, Capital restante stays RD$10,000, and next
  Interés is RD$500

#### Scenario: Interés + capital

- **WHEN** the lender collects "Interés + capital" entering RD$2,000 capital
- **THEN** RD$2,500 is recorded, Capital restante becomes RD$8,000, and next
  Interés becomes RD$400

#### Scenario: Paying off the capital closes the loan

- **WHEN** the lender collects the interest plus the full remaining capital
- **THEN** the balance reaches RD$0 and the loan is marked paid/finished
