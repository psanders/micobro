## Context

Loans are created once (`lib/loans/createLoan.ts`) and never changed afterwards; the loan detail's ⋮ button shows a "Muy pronto" alert. The data model already anticipates more lifecycle states — `loanStatuses` is `active | paid | defaulted | cancelled`, but only `active` is ever written — and every active-loan surface (`composeRouteDay`, `composeUpcomingCustomers`, `getCustomerDetail`, `searchCustomers`) already filters on `status === "active"`.

Sync already supports what corrections need:

- `push.ts` replays `create` (append) and `update` (find the row by id, rewrite it in place) mutations for every entity, loans included. `loanRowValues` writes all 16 columns from the payload, so an `update` payload must be the full loan row.
- `pull.ts` pulls only `customers` and `loans`. A pulled row overwrites the local one unless that id has a `pending`/`failed` mutation, and a row missing from the Sheet is never deleted locally. Payments and visits are append-only and never pulled.
- `provisionSheet.ts` backfills queued mutations when a lender connects for the first time.
- `updateCustomer.ts` is the existing reference for an edit: validate, write the row with a fresh `updatedAt`, enqueue an `update` mutation carrying the full row.

## Goals / Non-Goals

**Goals:**

- Fix any term of a loan that has no payments, in place, keeping its id and code.
- Take a mistaken or dead loan out of every active view without losing its money trail, and undo that.
- One code path for lenders with and without Google Sheets.

**Non-Goals:**

- Editing a loan after payments exist, or moving payments between loans.
- Hard-deleting loans, payments or visits.
- Editing or voiding individual payments (a separate problem).
- Changing which customer a loan belongs to (archive + "Crear préstamo corregido" covers it).
- Using the `paid` and `defaulted` statuses; they stay unwritten.

## Decisions

**1. Archive = `status: "cancelled"`, shown as "Archivado".**
The value already exists in the enum, the DB column and the Sheet's status column, so there's no migration and the active filters already exclude it. Alternative: a new `archived` status or an `archivedAt` column — needs an enum change and gives nothing extra. A hard delete was rejected: pull would resurrect the row from the Sheet, and push has no delete operation.

**2. Three validated functions in `lib/loans/`, following `updateCustomer`.**

- `updateLoan({ id, ...terms })` — rejects if the loan is missing, not `active`, or has any payment; validates terms with the same Zod rules as `createLoan` (extract the shared shape rather than duplicating it); writes the row with a new `updatedAt`; enqueues an `update` mutation with the full row.
- `archiveLoan({ id })` — `active` → `cancelled`.
- `restoreLoan({ id })` — `cancelled` → `active`.

All three write the row and then insert the mutation, the same sequence `createLoan` and `updateCustomer` use. The payments check lives in `updateLoan` itself, not only in the UI, so it can't be bypassed.

**3. Editability is derived, not stored.**
`getLoanDetail` gains `paymentCount` (or `canEdit`), computed from local payments for that loan. No pre-edit pull: payments are never pulled, so the device is their only source and a pull would add latency without changing the answer.

**4. Schedule recomputation is free.**
Cuotas, totals, mora and due dates are all derived at read time from the loan's terms (`loanMath.ts`, `loanViews.ts`, `openCredit.ts`). Rewriting the terms is enough; nothing derived is persisted. `startDate` holds the first payment date the form already edits.

**5. One form, three modes.**
`NewLoanFormScreen` takes a mode: `create` (today), `edit` (loanId → prefilled, saves with `updateLoan`, customer locked), and `create-from` (loanId → prefilled from the archived loan, saves with `createLoan` for the same customer). Alternative: a separate edit screen — duplicates the form and its validation messages.

**6. "Crear préstamo corregido" archives first, then opens the form.**
Archiving is the committed action the lender confirmed; the new loan is optional. If they back out of the form, the old loan is still archived, matching the spec. Doing it the other way round (archive on save) would leave a half-done state on crashes and couples two unrelated writes.

**7. Archived loans load separately.**
`getCustomerDetail` returns `archivedLoans` alongside the active list; Archivados is collapsed by default to keep the screen focused. `LoanDetailScreen` reads `status` to swap the action bar for Restaurar and show the Archivado indicator.

## Risks / Trade-offs

- [A loan with a pending (unpushed) create is edited] → The queue replays create then update in order, so the Sheet ends with the latest terms. Covered by a push test.
- [Sheet hand-edit vs. app edit on the same loan] → Existing rule: the unpushed app edit wins until pushed; after that, the next Sheet edit wins. No new conflict handling.
- [Lender archives the wrong loan] → Restaurar returns it to active with nothing lost.
- [Lender edits a loan, then a payment is recorded on another device before sync] → Out of scope: the app is single-device per lender, and payments are never pulled.
- [Archived loan still has an outstanding balance] → Intentional: archive means "stop tracking", and its collected money stays in Cuadre. The balance isn't counted anywhere active.

## Migration Plan

No schema migration — `status` already accepts `cancelled`. Ship behind no flag; existing loans are all `active` and unaffected. Rollback is a normal app release; any loans archived in the meantime stay `cancelled` and are simply hidden by the existing active filters.

## Open Questions

- Should Editar préstamo also be allowed when the only payments were recorded today (an immediate typo)? Not in this change: any payment locks.
