# Spec Delta

## Purpose

Defines what the app sends to the back office while connected (its outbox,
as contract v1 mutations, plus a one-time upload of existing data) and how
it handles each per-mutation result.

## ADDED Requirements

### Requirement: The outbox is sent as contract v1 batches

While connected, the app SHALL send its queued changes as contract v1 sync
batches, in the order they were made. Each change's app id SHALL be its
entity id on the server, and each queued change's id its mutation id, so
sending the same batch twice changes nothing.

#### Scenario: Batch sent twice

- **WHEN** a batch is sent, the response is lost, and the app sends it again
- **THEN** the server answers "duplicate" for each change, and nothing is recorded twice

### Requirement: What each kind of change becomes

The app SHALL map its changes to contract mutations: a customer create or
edit → `customer.upsert`; a new loan → `loan.create` with the schedule the
app showed; an edited loan → `loan.update`; archive and restore →
`loan.archive` and `loan.restore`; payment rows → `payment.collect`; a
deleted payment → `payment.void`; a visit → `visit.log`; a cierre →
`cashClose.create`.

#### Scenario: A cobro with mora

- **WHEN** the lender records a cobro the app splits into a mora row and a cuota row
- **THEN** the back office receives one `payment.collect` with both parts, a mora part and an installment part, sharing the cobro's time

#### Scenario: Archiving a loan

- **WHEN** the lender archives a loan
- **THEN** the back office receives `loan.archive` for that loan, not a loan edit

### Requirement: Cash closes list the payments they counted

A `cashClose.create` SHALL carry the ids of the payments the app counted
into that close, so the back office can check the total.

#### Scenario: Close after three cobros

- **WHEN** the lender closes the caja after three cobros since the last close
- **THEN** the close sent lists those three payment ids and the app's total

### Requirement: Initial upload of existing data

Right after connecting, the app SHALL queue everything already on the
phone once: customers, then loans, then payments, visits and cash closes,
each in creation order. It SHALL show progress and SHALL keep working
offline.

#### Scenario: Lender with history connects

- **WHEN** a lender with 40 customers and 300 payments connects
- **THEN** all of them are queued in that order and sent through the normal sync, and the app stays usable during the upload

#### Scenario: Upload interrupted

- **WHEN** connectivity drops halfway through the upload
- **THEN** what was sent stays sent, the rest stays queued, and nothing is queued twice

### Requirement: Retryable results stay queued and retry quietly

A change answered `NOT_YET`, `NOT_FOUND` or `UPSTREAM`, or a batch that
never got an answer, SHALL stay queued and retry with the existing retry
policy, without interrupting the lender.

#### Scenario: Server not reachable

- **WHEN** a sync fails because the back office can't be reached
- **THEN** every change stays queued and is retried on the next trigger

#### Scenario: Cobro dated after the server's day

- **WHEN** a cobro is answered `NOT_YET`
- **THEN** it stays queued and is sent again on later syncs until applied

### Requirement: Results that can't be applied need attention

A change answered `UNSUPPORTED`, `CONFLICT` or `VALIDATION` SHALL stop
retrying and count as "Necesita atención". For each one the app SHALL keep
a Spanish explanation, and SHALL keep sending later changes that don't
depend on it.

#### Scenario: Crédito abierto loan

- **WHEN** a crédito abierto loan is answered `UNSUPPORTED`
- **THEN** it shows under "Necesita atención" with an explanation that the back office doesn't support crédito abierto yet, and the lender's other changes keep syncing

#### Scenario: Duplicate phone

- **WHEN** a customer is refused as a `CONFLICT` because another customer has the same phone
- **THEN** it shows under "Necesita atención" saying the phone is already used by another customer

### Requirement: Drift is recorded, not shown

When the back office reports drift (its numbers differ from what the app
showed), the app SHALL treat the change as applied and record the drift in
its logs. The app SHALL NOT change its own numbers or show drift to the
lender.

#### Scenario: Mora differs

- **WHEN** a cobro is applied with `moraBeforeCents` drift
- **THEN** the cobro leaves the queue, the drift is logged, and the lender sees no message
