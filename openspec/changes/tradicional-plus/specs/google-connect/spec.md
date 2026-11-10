# Spec Delta

## ADDED Requirements

### Requirement: New Sheets are provisioned with Tipo

Provisioning SHALL create the Pagos tab with "Tipo" in H1 and a warning-only
protection on column H, so the first sync needs no Tipo migration and shows no
update notice.

#### Scenario: New Sheet

- **WHEN** the lender connects Google and the Datos spreadsheet is created
- **THEN** its Pagos tab reads "Tipo" in H1, column H is protected, and the
  first sync shows no "Actualiza Micobro en tus otros teléfonos" alert
