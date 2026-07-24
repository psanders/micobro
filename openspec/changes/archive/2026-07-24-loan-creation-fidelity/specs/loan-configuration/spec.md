## ADDED Requirements

### Requirement: Equal-size installments

The loan's cuotas SHALL be equal whole-peso amounts. The base cuota is the
total the loan collects (`principal + flat add-on interest`, see
`lib/loans/loanMath.ts`) divided across the number of pagos and rounded to
the nearest whole peso; every installment carries that amount except the
final one, which absorbs the remainder so the schedule sums back exactly to
the total. This replaces the previous round-up-to-the-nearest-50-pesos
behavior. The Nuevo Préstamo cost preview surfaces the base cuota as "Cuota
estimada" and, when the final cuota differs, an "Última cuota" line.

#### Scenario: Cuotas divide evenly

- **WHEN** a loan of RD$15,000 at 10% over 12 pagos is previewed (total to
  collect RD$16,500)
- **THEN** every cuota is RD$1,375 and no distinct "Última cuota" line is shown

#### Scenario: Final cuota absorbs the remainder

- **WHEN** a loan of RD$15,000 at 10% over 7 pagos is previewed (total to
  collect RD$16,500)
- **THEN** the base cuota is RD$2,357 and the final cuota is RD$2,358,
  shown as a distinct "Última cuota" line, and the seven cuotas sum to
  RD$16,500
