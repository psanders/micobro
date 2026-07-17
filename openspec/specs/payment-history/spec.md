# payment-history

## Purpose

The Histórico de Pagos screen — a loan's full payment ledger, reached from
Préstamo Detalle's "Ver historial" link.

## Requirements

### Requirement: Histórico de pagos summary

The screen SHALL show a brand-deep summary card with total cobrado for the
loan, cuotas pagadas (n de total), mora pagada, and the date of the last
payment.

#### Scenario: Summary reflects payments

- **WHEN** the mock exemplar loan's history opens
- **THEN** the summary shows the total collected, cuotas paid, and last payment date

### Requirement: Payment entries list

The screen SHALL list every recorded payment newest first, each with its
date, a label (cuota number or "Abono a cuenta"), a method/receipt/mora
sub-line, and its amount.

#### Scenario: Entries render in order

- **WHEN** a loan has multiple recorded payments
- **THEN** they render newest first with date, label, and amount

### Requirement: Ver historial navigation

Préstamo Detalle's "Ver historial" link SHALL open this screen for that
loan instead of showing an informational dialog.

#### Scenario: Open from loan detail

- **WHEN** the user taps Ver historial on Préstamo Detalle
- **THEN** the Histórico de pagos screen opens for that loan

### Requirement: Print placeholder

The "Imprime el historial" action SHALL show an informational dialog until
printing is built.

#### Scenario: Tap print

- **WHEN** the user taps the print action
- **THEN** an informational dialog explains it is not yet available
