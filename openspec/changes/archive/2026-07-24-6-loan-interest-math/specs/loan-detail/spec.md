## ADDED Requirements

### Requirement: Total cost of loan

The balance summary card SHALL show a caption beneath the balance amount
with the total the loan will collect over its life ("Total a pagar" —
principal plus flat add-on interest, see `lib/loans/loanMath.ts`), and,
when the loan carries a nonzero interest rate, the interest amount
alongside it, so the client and lender both see the full cost of the loan
next to the outstanding balance.

#### Scenario: Interest-bearing loan

- **WHEN** a loan carries a nonzero interest rate
- **THEN** the summary card shows "Total a pagar <amount>" and "Interés <amount>" beneath the balance

#### Scenario: Zero-interest loan

- **WHEN** a loan carries a zero interest rate
- **THEN** the summary card shows "Total a pagar <amount>" without an interest figure

## MODIFIED Requirements

### Requirement: Total a pagar hoy

The screen SHALL show a "TOTAL A PAGAR HOY" card with the amount the
client owes now and one breakdown line per component (overdue cuota with
its date; mora with accumulated days, highlighted in orange). When nothing
is overdue, the card SHALL show the next cuota as the single line. The
cuota amount is interest-inclusive (flat add-on interest folded into the
cuota, see `lib/loans/loanMath.ts`), not bare principal ÷ term.

#### Scenario: Overdue cuota plus mora

- **WHEN** the mock exemplar loan has cuota 4 overdue (RD$2,700, interest-inclusive) with RD$750 mora
- **THEN** the card totals RD$3,450 with a cuota line and an orange mora line

#### Scenario: Nothing overdue

- **WHEN** a loan has no overdue cuotas
- **THEN** the card shows the next cuota's amount as the only line
