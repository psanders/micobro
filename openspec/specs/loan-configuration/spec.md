# loan-configuration Specification

## Purpose

TBD - created by archiving change 55-open-credit-loans. Update Purpose after archive.

## Requirements

### Requirement: Create an open-credit loan

The Nuevo Préstamo form's "Tipo de préstamo" selector SHALL offer "Crédito
Abierto" alongside "Tradicional". When Crédito Abierto is selected, the form
collects capital (monto), a **per-cycle** interest rate, and a cycle frecuencia,
and SHALL NOT collect a "Plazo (número de cuotas)" — an open-credit loan has no
fixed term. The loan is stored with `loanType = "open_credit"`; its
`interestRateBps` is the per-cycle rate applied to the outstanding capital.

#### Scenario: Open credit hides the term field

- **WHEN** the lender selects Tipo de préstamo = "Crédito Abierto"
- **THEN** the "Plazo (número de cuotas)" field is not shown and the interest
  field is labeled as a per-cycle rate

#### Scenario: Term loan still requires a term

- **WHEN** the lender selects Tipo de préstamo = "Tradicional"
- **THEN** the "Plazo (número de cuotas)" field is shown and required as today
