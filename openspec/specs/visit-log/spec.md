# visit-log

## Purpose

The visit-outcome flow — recording a collector's visit to a customer
(payment promise or otherwise) from Préstamo Detalle's "Anotar visita"
action, and surfacing it in the customer's history.

## Requirements

### Requirement: Record a visit outcome

From Préstamo Detalle's "Anotar visita" action, the app SHALL open an
outcome picker — Promesa de pago, Sin contacto, No quiere pagar,
Reagendar — against that loan's customer, and save it via "Guardar
visita".

#### Scenario: Save a non-promise outcome

- **WHEN** the collector picks "Sin contacto" and taps Guardar visita
- **THEN** a visit record is saved for that customer/loan and the modal closes back to the loan

### Requirement: Promise-to-pay details

When "Promesa de pago" is selected, the screen SHALL additionally require a
promise date, a promise time, and a promised amount (prefilled with the
loan's total-a-pagar-hoy amount, editable), plus an optional comment.

#### Scenario: Save a promise

- **WHEN** the collector picks Promesa de pago, sets a date/time/amount, and taps Guardar visita
- **THEN** the visit is saved with the promise fields attached

### Requirement: Visit appears in customer history

A saved visit SHALL appear in that customer's Cliente Detalle "Visitas
recientes" list alongside payments, newest first.

#### Scenario: Visit shows in recent activity

- **WHEN** a visit was just recorded for a customer
- **THEN** opening that customer's detail shows the visit's outcome in Visitas recientes
