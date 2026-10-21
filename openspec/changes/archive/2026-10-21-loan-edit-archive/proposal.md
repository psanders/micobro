## Why

A lender who makes a mistake creating a loan — wrong principal, wrong number of cuotas, wrong rate, wrong customer — has no way to fix it from the app. Lenders with Google Sheets sync can only patch the row in the Sheet by hand; lenders without sync are stuck with a wrong loan that keeps showing up in Ruta, Hoy and the customer's counts. The loan detail's "Más opciones" (⋮) menu is still a "Muy pronto" placeholder.

## What Changes

- The loan detail ⋮ menu opens real actions instead of the "Muy pronto" alert.
- **Editar préstamo** — available only while the loan has no payments. Opens the new-loan form prefilled with the loan's current terms (principal, cuotas, rate, frequency, first payment date, mora settings, loan type); the customer is fixed. Saving recomputes the schedule from the new terms.
- **Archivar préstamo** — available on any non-archived loan. Moves it out of every active view (Ruta, Hoy, active counts, "PRÉSTAMOS ACTIVOS"). When the loan has payments, editing is locked and the archive confirmation offers **Crear préstamo corregido**, which opens the new-loan form for the same customer prefilled with the archived loan's terms.
- Payments on an archived loan are kept untouched: they stay in its payment history and still count in Cuadre de caja (the money was really collected).
- **Archivados** — a new, collapsed section on customer detail listing archived loans; they open read-only (no Cobrar / Anotar visita / Editar) and offer **Restaurar**, which returns the loan to active.
- Archive is a status change, never a delete: pull never deletes local rows and push has no delete operation, so a deleted loan would be resurrected from the Sheet.
- Edit, archive and restore work identically with or without Google Sheets sync: they write SQLite first and enqueue an `update` mutation. Connected lenders' Sheet row is corrected in place on push; unconnected lenders' queued updates are backfilled when they connect.
- Whether a loan is editable is decided from the payments on the device. Payments are append-only and never pulled from the Sheet, so the device is the only place they are recorded.

## Capabilities

### New Capabilities

- `loan-correction`: Editing a payment-free loan, archiving and restoring loans, the payments lock, "Crear préstamo corregido", and how these changes sync for connected and unconnected lenders.

### Modified Capabilities

- `loan-detail`: The ⋮ menu exposes Editar / Archivar; an archived loan's detail is read-only with Restaurar instead of the Cobrar / Anotar visita action bar.
- `customer-detail`: New "Archivados" section listing archived loans below the active ones.

## Impact

- **UI**: `components/screens/LoanDetailScreen.tsx` (⋮ menu, archived read-only state), `components/screens/NewLoanFormScreen.tsx` (edit + prefill modes), customer detail screen (Archivados section), new routes for edit/prefilled-create. Pencil designs required first (design gate).
- **Business logic**: new validated functions in `lib/loans/` — `updateLoan`, `archiveLoan`, `restoreLoan` — following the `createLoan` pattern, each enqueueing an `update` pending mutation; a `loanHasPayments` check.
- **Repo layer**: `lib/repo/` loan repo + mock repo gain the three operations; `getCustomerDetail` returns archived loans separately.
- **Sync**: no new mutation types — `push.ts` already corrects loan rows in place for `update`; `provisionSheet.ts` already backfills queued mutations. Status values already include `cancelled`; no schema migration.
- **Tests**: Jest tests per new function; Maestro smoke flow for edit and archive.
