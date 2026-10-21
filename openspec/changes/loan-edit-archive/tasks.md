## 0. Design gate (before any UI code)

- [x] 0.1 Pencil: loan detail ⋮ menu — payment-free variant (Editar / Archivar) and with-payments variant (Archivar + "no se puede editar" note)
- [x] 0.2 Pencil: archive confirmation — plain and with "Crear préstamo corregido"
- [x] 0.3 Pencil: new-loan form in edit mode (title, locked customer, save label)
- [x] 0.4 Pencil: archived loan detail (Archivado indicator, Restaurar instead of the action bar)
- [x] 0.5 Pencil: customer detail ARCHIVADOS section, collapsed and expanded
- [x] 0.6 Pedro approves the designs

## 1. Business logic

- [x] 1.1 Extract the shared loan-terms Zod shape from `createLoan`'s schema so create and update validate identically
- [x] 1.2 `lib/loans/updateLoan.ts`: reject missing, non-active, or loans with payments; write terms + `updatedAt`; enqueue a full-row `update` mutation in one transaction
- [x] 1.3 `lib/loans/archiveLoan.ts` (`active` → `cancelled`) and `lib/loans/restoreLoan.ts` (`cancelled` → `active`), each enqueueing a full-row `update` mutation
- [x] 1.4 Export the three from `lib/loans/index.ts`
- [x] 1.5 Jest tests: `updateLoan.test.ts`, `archiveLoan.test.ts`, `restoreLoan.test.ts` — happy paths, payments lock, wrong-status rejection, validation errors, mutation payload is the full row

## 2. Read side

- [x] 2.1 Loan detail data exposes `status` and whether the loan has payments (`canEdit`)
- [x] 2.2 `getCustomerDetail` returns `archivedLoans` alongside active loans
- [x] 2.3 Verify Ruta, Hoy (goal + upcoming), customer search counts and PRÉSTAMOS ACTIVOS exclude `cancelled`; add a test per surface — all already filter on `active`; tests added for composeRouteDay (Ruta + Hoy goal/upcoming) and getCustomerDetail (active vs archived)
- [x] 2.4 Verify Cuadre's total and payment history still include payments on a `cancelled` loan; add a test
- [x] 2.5 Repo layer: add `update`, `archive`, `restore` to the loan repo (real + mock) and fixtures with an archived loan

## 3. UI

- [x] 3.1 Loan options menu replacing the "Muy pronto" alert on `LoanDetailScreen`
- [x] 3.2 Archive confirmation, including "Crear préstamo corregido" (archive, then open the form prefilled for the same customer)
- [x] 3.3 `NewLoanFormScreen` modes: `edit` (prefilled, customer locked, saves via `updateLoan`) and `create-from` (prefilled, saves via `createLoan`)
- [x] 3.4 Archived loan detail: Archivado indicator, Restaurar replaces Cobrar / Anotar visita; schedule and Ver historial still work
- [x] 3.5 Customer detail ARCHIVADOS section (collapsed by default, count, opens read-only detail)
- [x] 3.6 Storybook stories for the new menu, confirmation and Archivados section

## 4. Sync

- [x] 4.1 Push test: a loan `update` after `create` rewrites the same Sheet row, no duplicate
- [x] 4.2 Pull test: a pending archive is not overwritten by the Sheet's `active` value
- [x] 4.3 Provision/backfill test: edit + archive before connecting leaves the Sheet row with final terms and `cancelled`

## 5. End-to-end

- [x] 5.1 Maestro flow: create loan → edit cuotas → see new schedule
- [x] 5.2 Maestro flow: collect on a loan → edit unavailable → archive → gone from Ruta/active, present under Archivados → Restaurar
- [x] 5.3 Emulator check without Google connected: edit, archive and restore work with no error
