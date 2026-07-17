## ADDED Requirements

### Requirement: Cédula capture

The Nuevo Cliente and Editar Cliente forms SHALL offer an optional cédula
field. Input SHALL be accepted with or without dashes; on save it SHALL be
validated as exactly 11 digits (after stripping any non-digit characters)
and stored normalized to those 11 digits. Input that isn't exactly 11
digits SHALL be rejected with a Spanish validation message instead of
being saved.

#### Scenario: Save with a dashed cédula

- **WHEN** the lender types "001-1234567-8" into the cédula field and saves
- **THEN** the customer is saved with cédula "00112345678"

#### Scenario: Leave cédula blank

- **WHEN** the lender saves the form without entering a cédula
- **THEN** the customer is saved with no cédula recorded

#### Scenario: Reject a malformed cédula

- **WHEN** the lender enters a cédula that isn't 11 digits and saves
- **THEN** the form shows a validation error and nothing is saved

### Requirement: Avatar assignment

The Nuevo Cliente and Editar Cliente forms SHALL offer an optional avatar
picker over a curated, fixed set of bundled images (not a photo picker —
no camera or storage permission is requested). Selecting one and saving
SHALL assign it to the customer; leaving none selected SHALL leave the
customer without an avatar (falling back to initials wherever it's
displayed).

#### Scenario: Pick an avatar

- **WHEN** the lender selects an avatar from the picker and saves
- **THEN** the customer is saved with that avatar and it renders wherever the customer's avatar is shown (Cliente Detalle, Buscar, route stops)

#### Scenario: No avatar picked

- **WHEN** the lender saves without picking an avatar
- **THEN** the customer has no avatar and displays as an initials circle
