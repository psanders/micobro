## MODIFIED Requirements

### Requirement: Próximas visitas list

The Hoy screen SHALL list upcoming visits (name, avatar, address/detail
line, amount due, and a status label such as "Hoy" or "Mora"), with a "Ver
todas" link that opens the Ruta tab. Tapping a visit SHALL open that
customer's detail. When there are no visits due today or overdue, the card
SHALL instead list up to 4 customers whose next unpaid installment is
coming up (not yet due), each showing name, avatar, address, and the next
cuota's amount and due date, so the card isn't a duplicate of today's
route or of Buscar's full customer list. Tapping one of those rows SHALL
also open that customer's detail. Only when there are neither visits due
today nor any upcoming customers (e.g. no active loans at all) SHALL the
plain empty state be shown.

#### Scenario: Visit row opens customer

- **WHEN** the user taps a visit row for a customer
- **THEN** the customer's detail screen opens

#### Scenario: Ver todas

- **WHEN** the user taps "Ver todas"
- **THEN** the Ruta tab becomes active

#### Scenario: Nothing due today, but customers have upcoming cuotas

- **WHEN** Hoy loads and no loan has an installment due today or overdue,
  but at least one active loan has a future due date
- **THEN** the card lists up to 4 of those customers (soonest due date
  first) with their next cuota's amount and date, instead of the empty
  state

#### Scenario: Truly nothing to show

- **WHEN** Hoy loads and there are neither visits due today nor any
  customers with an upcoming installment
- **THEN** the card shows "No hay visitas programadas para hoy."
