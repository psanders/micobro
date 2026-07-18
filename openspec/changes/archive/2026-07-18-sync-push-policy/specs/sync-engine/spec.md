## ADDED Requirements

### Requirement: Push runs immediately after a local mutation

The app SHALL attempt to push queued mutations to the lender's Google Sheet immediately after each local mutation is queued (customer, loan, payment, or visit), not only at connect time or when the lender manually syncs.

#### Scenario: Creating a customer while online triggers a push

- **WHEN** the lender creates a customer while the device has connectivity
- **THEN** the app attempts to push the queued mutation without the lender opening Ajustes or tapping "Sincronizar ahora"

#### Scenario: Creating data while offline queues without pushing

- **WHEN** the lender records a payment while the device has no connectivity
- **THEN** the mutation is queued locally and no push is attempted until connectivity returns

### Requirement: Reconnecting triggers a push

The app SHALL detect the offline-to-online connectivity transition and attempt a push of any queued mutations as soon as it occurs, without requiring the lender to take any action.

#### Scenario: Regaining connectivity pushes queued mutations

- **WHEN** the device transitions from offline to online and mutations are queued
- **THEN** the app attempts a push automatically, without the lender opening the app to a specific screen or tapping a button

#### Scenario: Staying online does not re-trigger on every status check

- **WHEN** the device remains online and no new mutation was queued
- **THEN** no additional automatic push is triggered beyond the normal on-mutation and on-reconnect triggers

### Requirement: Only one push runs at a time

The app SHALL ensure that automatic pushes (on-mutation, on-reconnect) and the manually-triggered "Sincronizar ahora" push never run concurrently; a trigger that arrives while a push is already in flight SHALL be a no-op for that trigger.

#### Scenario: Manual push while an automatic push is in flight

- **WHEN** the lender taps "Sincronizar ahora" while an automatic push triggered by reconnecting is already running
- **THEN** the manual tap does not start a second concurrent push

#### Scenario: Two automatic triggers arrive close together

- **WHEN** a mutation is queued at nearly the same moment connectivity is regained
- **THEN** only one push runs for both triggers, not two overlapping pushes

### Requirement: Automatic pushes fail silently; manual pushes surface errors

Automatic pushes (on-mutation, on-reconnect) SHALL NOT interrupt the lender when they fail — the failure is logged and left for the retry policy to handle. The manually-triggered "Sincronizar ahora" push SHALL continue to surface failures to the lender as it does today.

#### Scenario: An automatic push fails

- **WHEN** a push triggered automatically (not by the lender tapping "Sincronizar ahora") fails
- **THEN** no error dialog or interruption is shown to the lender, and the failure is logged

#### Scenario: A manual push fails

- **WHEN** the lender taps "Sincronizar ahora" and the push fails
- **THEN** the app surfaces the failure to the lender, as before this change

### Requirement: Retryable failures keep retrying; exhausted ones are surfaced, never silently dropped

A mutation that fails to push SHALL remain eligible for future push attempts until it exceeds the retry cap; the "pendientes" count SHALL include every mutation still eligible for retry. Once a mutation exceeds the retry cap, it SHALL be surfaced to the lender as needing attention rather than disappearing from every count.

#### Scenario: A mutation fails once and is retried later

- **WHEN** a queued mutation fails to push once and has not exceeded the retry cap
- **THEN** it remains included in future push attempts and in the "pendientes" count shown to the lender

#### Scenario: A mutation exhausts its retries

- **WHEN** a queued mutation has failed enough times to exceed the retry cap
- **THEN** it stops being retried automatically but is shown to the lender in a distinct "necesita atención" count rather than vanishing from view
