# Tasks: daily-sunday-skip

## 1. Schema + migration

- [ ] 1.1 `lib/db/schema.ts` — nullable `skip_sundays` integer(boolean) on `loans`.
- [ ] 1.2 `npm run db:generate` — new migration (do not hand-edit).

## 2. Domain

- [ ] 2.1 `lib/loans/loan.schema.ts` — `createLoanSchema.skipSundays?`; `Loan.skipSundays: boolean | null`.
- [ ] 2.2 `lib/loans/createLoan.ts` + `lib/repo/mock/index.ts` — persist `skipSundays ?? null`.
- [ ] 2.3 `lib/loans/loanViews.ts` — `installmentDueDate` skips Sundays for daily loans with the flag; add a day-walk helper. Weekly/quincenal/mensual unchanged.
- [ ] 2.4 `lib/loans/mora.ts` — overdue-day count excludes Sundays when the loan skips Sundays.
- [ ] 2.5 Export any new helper from `lib/loans/index.ts`.

## 3. Form

- [ ] 3.1 `NewLoanFormScreen.tsx` — "Saltar domingos" `Toggle` shown only when frecuencia === "daily"; pass `skipSundays` to create.

## 4. Sync round-trip

- [ ] 4.1 `lib/sync/push.ts` — emit `skip_sundays` (range + `loanRowValues`).
- [ ] 4.2 `lib/sync/pull.ts` — parse `skip_sundays` in `rowToLoan`.
- [ ] 4.3 `lib/sync/provisionSheet.ts` — add the header.

## 5. Tests

- [ ] 5.1 `__tests__/loanViews.test.ts` — daily schedule skips Sundays (Sunday→Monday; spans extra calendar days); non-daily unaffected; flag off unchanged.
- [ ] 5.2 `__tests__/mora.test.ts` — business-days-late count for a skip-Sundays loan.
- [ ] 5.3 `__tests__/createLoan.test.ts` — persists skipSundays; validation-failure case.
- [ ] 5.4 `__tests__/push.test.ts` / `pull.test.ts` — round-trip the column.
- [ ] 5.5 Update loan fixtures with `skipSundays: null`.

## 6. Verify

- [ ] 6.1 `npx tsc --noEmit`; `npm run lint`; `npx jest` — all green.
- [ ] 6.2 Manual test on emulator: daily loan + Saltar domingos → no Sunday due dates.

## 7. Design parity (Pencil)

- [ ] 7.1 Add the "Saltar domingos" toggle (daily-only) to the `Mac4Z` design.
