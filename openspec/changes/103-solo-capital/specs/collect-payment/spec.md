## MODIFIED Requirements

### Requirement: Collect an open-credit payment

For an open-credit loan, the cobrar screen SHALL present the current cycle's
interest under the label **Interés del próximo pago** — not "pendiente", since
during an in-progress cycle that interest is not owed yet — and three payment
options — **Solo interés** (pay exactly the
cycle interest, capital unchanged), **Interés + capital** (pay the interest plus
a lender-entered capital amount), and **Solo capital** (pay a lender-entered
amount that goes entirely to capital) — with a "Después del pago" preview of the
resulting Capital restante and next Interés. Recording the payment stores an
ordinary amount+date row; when the payment brings the capital balance to zero
the loan is marked paid/finished.

Which options are selectable SHALL depend on whether the current cycle's
interest has been covered in full by payments already recorded inside that
cycle:

- While the cycle's interest is NOT fully covered, **Solo interés** and
  **Interés + capital** SHALL be selectable and **Solo capital** SHALL be
  disabled.
- Once the cycle's interest IS fully covered, **Solo interés** SHALL be
  disabled and show RD$0 — never the following cycle's interest — **Interés +
  capital** SHALL be disabled, and **Solo capital** SHALL be selectable.

Disabled options SHALL remain visible, with a note stating the interest for
this cycle has already been paid. **Solo capital** SHALL NOT be preselected:
paying capital without interest is not the ordinary case, so when the cycle's
interest is covered the screen SHALL open with no option selected and the
lender SHALL choose **Solo capital** deliberately. Confirming SHALL stay
unavailable until an option is selected and its amount is greater than zero.

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

#### Scenario: Solo capital unlocks once the cycle interest is covered

- **WHEN** the cycle's interest has already been paid in full and the lender
  opens the cobrar screen
- **THEN** "Solo capital" is selectable, "Solo interés" is disabled showing
  RD$0, "Interés + capital" is disabled, and a note states the interest for
  this cycle is already paid

#### Scenario: A Solo capital payment reduces the balance in full

- **WHEN** the cycle's interest is covered and the lender collects RD$5,000 as
  "Solo capital" on an RD$10,000 balance
- **THEN** RD$5,000 is recorded, Capital restante becomes RD$5,000, and the
  next cycle's Interés drops accordingly

#### Scenario: Solo capital is never preselected

- **WHEN** the cycle's interest is covered and the lender opens the cobrar
  screen
- **THEN** no payment option is selected and confirming is unavailable until
  the lender picks "Solo capital" and enters an amount

#### Scenario: Solo capital stays disabled while interest is only partly covered

- **WHEN** RD$400 of a RD$1,000 cycle interest has been paid
- **THEN** "Solo capital" is disabled, and "Solo interés" and "Interés +
  capital" remain selectable for the RD$600 remainder

#### Scenario: The next cycle re-arms the interest options

- **WHEN** a cycle whose interest was covered ends and the next cycle begins
- **THEN** "Solo interés" and "Interés + capital" are selectable again for the
  new cycle's interest, and "Solo capital" is disabled until that interest is
  covered

#### Scenario: The screen never offers the following cycle's interest

- **WHEN** the current cycle's interest has been covered in full
- **THEN** no option offers to collect the following cycle's interest amount
