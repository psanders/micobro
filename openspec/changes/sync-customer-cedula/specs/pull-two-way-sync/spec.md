# Spec Delta

## ADDED Requirements

### Requirement: The customer cédula is synced through the Clientes tab

The `Clientes` tab SHALL carry each customer's cédula in a "Cédula" column
right after Nombre (column C). Push SHALL write it as `XXX-XXXXXXX-X`, or an
empty cell when the customer has none. Pull SHALL accept it with or without
dashes, store it as digits only, and apply it under the same
remote-wins-with-guard rule as other customer fields, including an empty
cell clearing it.

#### Scenario: A customer's cédula appears in the Sheet

- **WHEN** a lender saves a customer with cédula `00112345678` and the mutation pushes
- **THEN** that customer's `Clientes` row shows `001-1234567-8` in column C,
  with its leading zeros intact

#### Scenario: A customer without a cédula leaves the cell empty

- **WHEN** a customer with no cédula is pushed
- **THEN** that row's Cédula cell is empty

#### Scenario: A cédula corrected in the Sheet reaches the app

- **WHEN** a lender types `402-0000000-1` (or `40200000001`) into a customer's
  Cédula cell in the Sheet and the app pulls
- **THEN** the local customer's cédula is `40200000001`

#### Scenario: A cédula cleared in the Sheet is cleared in the app

- **WHEN** a lender empties a customer's Cédula cell in the Sheet and the app
  pulls, with no unpushed local mutation for that customer
- **THEN** the local customer has no cédula

#### Scenario: A row typed into the Sheet with a cédula is inserted with it

- **WHEN** a lender adds a new `Clientes` row that includes a cédula and the app pulls
- **THEN** the new local customer has that cédula

### Requirement: Customer sync waits for the Cédula layout

The app SHALL NOT write or read `Clientes` rows until it has confirmed that
the tab has "Cédula" in `C1`, either by finding it there or by completing the
one-time column insertion. While that is unconfirmed (e.g. the insertion
failed offline), customer mutations SHALL stay queued with no retry spent,
and pull SHALL skip customers. Other entities SHALL sync normally.

#### Scenario: Offline during the layout move

- **WHEN** the column insertion fails because the device lost connectivity
- **THEN** no customer row is written to or read from the Sheet, queued
  customer mutations are still pending with their retry count unchanged, and
  loans, payments, visits and cash closes still push

#### Scenario: Customer sync resumes after the move succeeds

- **WHEN** a later sync completes the column insertion
- **THEN** the queued customer mutations push into the new layout in the same sync

### Requirement: Existing customers are re-sent once so pull cannot erase their cédula

Before its first pull with the Cédula column, the app SHALL queue one update
mutation for each local customer that has a cédula and no update already
queued, and SHALL never do so again on that device. This fills the Cédula
column for rows already in the Sheet. Until each customer's update pushes,
the unpushed-edit guard protects that customer's local cédula from pull.

#### Scenario: Customers saved before the upgrade get their cédula in the Sheet

- **WHEN** a lender who already synced customers with cédulas upgrades and the
  app next syncs
- **THEN** those customers' existing `Clientes` rows are updated in place with
  their cédula, and no duplicate rows are created

#### Scenario: The first pull after upgrade does not erase cédulas

- **WHEN** the app pulls before the re-sent customer updates have pushed (e.g.
  some of them failed while offline)
- **THEN** customers whose update is still pending or failed keep their local
  cédula

#### Scenario: The re-send happens only once

- **WHEN** the app syncs again after the re-send was queued
- **THEN** no further re-send mutations are queued, even for customers whose
  cédula a later pull cleared
