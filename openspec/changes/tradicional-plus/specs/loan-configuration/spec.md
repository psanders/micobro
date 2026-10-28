# Spec Delta

## ADDED Requirements

### Requirement: Create a Tradicional Plus loan

The Nuevo Préstamo "Tipo de préstamo" selector SHALL offer "Tradicional Plus"
alongside "Tradicional" and "Crédito Abierto". When it is selected, the form
SHALL collect monto, interest rate and "Plazo (número de cuotas)" as for
Tradicional, a required "Penalidad" amount in whole pesos greater than zero,
and "Período de gracia (días)". The loan is stored with `loanType = "term_plus"`.

#### Scenario: Penalty is required

- **WHEN** the lender selects Tradicional Plus and leaves Penalidad empty
- **THEN** the form doesn't save and shows an error on the Penalidad field

#### Scenario: Cuotas computed as Tradicional

- **WHEN** a Tradicional Plus loan of RD$15,000 at 10% over 12 pagos is
  previewed
- **THEN** the cost preview shows a cuota of RD$1,375, the same as Tradicional

### Requirement: Tradicional Plus is quincenal only

When Tradicional Plus is selected, the frecuencia SHALL be fixed to Quincenal
and the lender SHALL NOT be able to choose another frequency.

#### Scenario: Frequency locked

- **WHEN** the lender selects Tradicional Plus
- **THEN** the frecuencia shows Quincenal and offers no other choice

#### Scenario: Switching back unlocks frequency

- **WHEN** the lender switches from Tradicional Plus back to Tradicional
- **THEN** every frequency can be chosen again

### Requirement: Tradicional Plus has no mora settings

When Tradicional Plus is selected, the form SHALL NOT show the mora toggle or
the mora rate; the penalty replaces mora for this loan type.

#### Scenario: Mora fields hidden

- **WHEN** the lender selects Tradicional Plus
- **THEN** the mora toggle and mora rate fields are not shown, and
  "Período de gracia (días)" and "Penalidad" are shown
