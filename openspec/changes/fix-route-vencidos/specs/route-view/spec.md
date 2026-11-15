## MODIFIED Requirements

### Requirement: Status filter chips

The Ruta screen SHALL show filter chips with live counts — Todas,
Pendientes, Atrasadas, Vencidos, Hechas — and selecting a chip SHALL filter
the visit list to matching visits (Todas shows everything).

A visit is **vencido** when it is not `done`, its loan has an end date, and
today (start of day) is after the start of that end date's day. The end date
SHALL be the loan's end date as computed for the receipt's "Vencimiento" row
(from the loan and the payments recorded before today), never recomputed
independently. Open-credit loans have no end date and SHALL never be
vencido. A loan whose end date is today is not vencido.

- **Vencidos** SHALL list exactly the vencido visits.
- **Atrasadas** SHALL list visits with an overdue status that are not
  vencido, however many days late they are.
- A vencido visit's detail line SHALL read "Venció hace N días" ("Venció
  hace 1 día" when N is 1), where N is the number of whole days from the
  loan's end date to today.

#### Scenario: Filter by overdue

- **WHEN** the user taps "Atrasadas"
- **THEN** only overdue visits whose loan has not passed its end date are
  listed and the chip renders selected

#### Scenario: Loan past its end date is vencido

- **WHEN** a loan's last cuota was due 3 days ago and is still unpaid
- **THEN** its visit appears under "Vencidos", not "Atrasadas", and its
  detail line reads "Venció hace 3 días"

#### Scenario: Late mid-term loan stays atrasada

- **WHEN** a loan's oldest unpaid cuota is 20 days late but its end date
  is still in the future
- **THEN** its visit appears under "Atrasadas", not "Vencidos"

#### Scenario: Open credit is never vencido

- **WHEN** an open-credit loan has unpaid interest
- **THEN** its visit never appears under "Vencidos"

#### Scenario: Collected today stays done

- **WHEN** a loan past its end date has a payment recorded today
- **THEN** its visit appears under "Hechas" only
