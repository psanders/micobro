# Tasks: per-loan-mora

## 1. Schema + loan configuration

- [x] 1.1 `lib/db/schema.ts` — nullable `loans.moraEnabled`
      (integer, `mode: "boolean"`) and `loans.moraRateBps` (integer)
      columns, ordered after `graceDays` and before `createdAt`, with a
      comment mirroring the `graceDays` "null = default" note
- [x] 1.2 `npm run db:generate` — new migration (do not hand-edit
      `lib/db/migrations/`)
- [x] 1.3 `lib/loans/loan.schema.ts` — `createLoanSchema` gains optional
      `moraEnabled` (`z.boolean().optional()`) and `moraRate`
      (`z.number().nonnegative(...).optional()`, Spanish message);
      `Loan` gains `moraEnabled: boolean | null` and
      `moraRateBps: number | null`
- [x] 1.4 `lib/loans/createLoan.ts` + `lib/repo/mock/index.ts`'s
      `createLoan` — persist `moraEnabled: params.moraEnabled ?? null`
      and `moraRateBps: params.moraRate != null ? Math.round(params.moraRate * 100) : null`

## 2. Wire per-loan mora into accrual

- [x] 2.1 `lib/loans/mora.ts` — `DEFAULT_MORA_RATE_BPS = 1000`;
      `isMoraEnabled(loan)` (`loan.moraEnabled ?? true`) and
      `effectiveMoraRateBps(loan)` (`loan.moraRateBps ?? DEFAULT_MORA_RATE_BPS`)
      helpers; `loanMoraPolicy(loan)` sets `rate` from
      `effectiveMoraRateBps / 10000` and to `0` when `!isMoraEnabled(loan)`
- [x] 2.2 `lib/loans/index.ts` — export `DEFAULT_MORA_RATE_BPS`,
      `isMoraEnabled`, `effectiveMoraRateBps`
- [x] 2.3 Confirm the four `computeLoanMora` call sites need no change
      (they already pass `loanMoraPolicy(loan)`)

## 3. Nuevo Préstamo form

- [x] 3.1 `components/screens/NewLoanFormScreen.tsx` — "Cobrar mora por
      atraso" `Switch` **defaulting to off** + conditional "Tasa de mora
      (%)" numeric field (pre-filled `10`, shown only when the switch is
      on), below the interest-rate field; submit sends
      `moraEnabled: <switch>` and, when on, `moraRate: Number(rate)`.
      Design: Collectors "06b Nuevo Préstamo" screen in `pencil.pen`.

## 4. Sync round-trip

- [x] 4.1 `lib/sync/push.ts` — `ENTITY_RANGES.loan` → `Préstamos!A:N`;
      `loanRowValues` emits `moraEnabled` and `moraRateBps` after
      `graceDays`
- [x] 4.2 `lib/sync/pull.ts` — `rowToLoan` destructures + parses the two
      new columns (`moraEnabled` as boolean, `moraRateBps` as number,
      both defaulting to `null` when blank)
- [x] 4.3 `lib/sync/provisionSheet.ts` — `TAB_HEADERS.loan` gains
      "Mora activa" and "Mora (bps)" (width auto-guarded by
      `provisionSheet.test.ts`)

## 5. Fixtures + tests

- [x] 5.1 `lib/repo/mock/fixtures.ts` — every loan fixture gets explicit
      `moraEnabled: null` and `moraRateBps: null`
- [x] 5.2 `__tests__/mora.test.ts` — `isMoraEnabled`,
      `effectiveMoraRateBps`, `loanMoraPolicy` (disabled → rate 0; custom
      rate; unset → 10% default); end-to-end `computeLoanMora` for a
      disabled loan (never accrues regardless of days late) and a
      custom-rate loan (uses that rate)
- [x] 5.3 `__tests__/push.test.ts` / `__tests__/pull.test.ts` — 14-column
      loan row round-trip (`Préstamos!A:N`, new mora columns)
- [x] 5.4 `npm run lint`, `npm run typecheck` (or `npx tsc --noEmit`),
      `npx jest` — all clean

## 6. Spec reconcile

- [x] 6.1 `specs/loan-detail/spec.md` delta — MODIFIED "Total a pagar hoy"
      (mora line gated by per-loan enablement; amount uses the loan's rate)
- [x] 6.2 `openspec validate 56-per-loan-mora --strict`
