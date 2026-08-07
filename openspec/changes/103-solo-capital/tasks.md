## 1. Design (Pencil)

- [x] 1.1 Add a **Solo capital** option row to `07c Cobrar Crédito Abierto`
- [x] 1.2 Draw the disabled state for **Solo interés** (RD$0) and **Interés +
      capital**
- [x] 1.3 Add the "interés ya pagado" note
- [x] 1.4 Produce both screen states — interest pending (`gH1rr`), and interest
      covered (`I5ASY`)
- [x] 1.5 Confirm the design with Pedro, then save `pencil.pen` from the app

## 2. Build

- [x] 2.1 Derive the option state from the loan's replayed cycles —
      `resolveOpenCreditPayOptions` in `lib/payments/openCreditPayOptions.ts`,
      extracted out of the screen so it is unit-testable (the repo has no
      React Native testing-library)
- [x] 2.2 Add `capital` to `OpenCreditPayOption`
- [x] 2.3 Gate the three options; show RD$0 on Solo interés when covered rather
      than the next cycle's interest
- [x] 2.4 Render disabled options greyed and non-selectable, with the note
- [x] 2.5 Leave **no** option selected when the interest is covered — Solo
      capital is chosen deliberately, never inherited
- [x] 2.6 Feed the amount, receipt lines and the "Después del pago" preview
      from the selected option

## 3. Tests

- [x] 3.1 Interest not covered → Solo interés + Interés + capital selectable,
      Solo capital disabled
- [x] 3.2 Interest covered → Solo interés disabled at RD$0, Interés + capital
      disabled, Solo capital selectable
- [x] 3.3 Interest covered by two smaller payments in the same cycle
- [x] 3.4 Interest covered by a payment made on the due date
- [x] 3.5 Partial coverage keeps Solo capital disabled
- [x] 3.6 Cycle rollover re-enables the interest options
- [x] 3.7 Zero-interest loan counts as covered (decision recorded below)
- [x] 3.8 Closed loan offers no interest collection
- [x] 3.9 A Solo capital payment reduces the balance by its full amount
- [x] 3.10 Maestro flow `credito-abierto-solo-capital.yaml` — **written, not
      executed.** Running it needs a demo build (`npm run start:demo`) on the
      emulator, which is currently serving a dev-client session; it is not part
      of `ci.yml` either. Must be run before this is considered proven.
- [x] 3.11 `npm run lint`, `npm run typecheck`, `npm run test` green — 478
      tests / 80 suites. (`npm run lint` also reports 18 pre-existing errors
      inside `.claude/worktrees/`, unrelated to this change and invisible to
      CI's clean checkout.)

## 4. Ship

- [ ] 4.1 Sync the delta into `openspec/specs/collect-payment`
- [ ] 4.2 Archive the change

## Decisions taken during build

- **Zero-interest cycle counts as covered.** The design.md open question is
  resolved: with nothing to collect for the cycle, capital is the only thing
  left to pay, so Solo capital opens immediately. No special case.
- **Solo capital is never preselected.** Paying capital without interest is not
  the ordinary case, so once the interest is covered the screen opens with no
  option selected and confirming stays unavailable until the lender picks one.
- **The receipt drops its Interés line on a capital-only payment** rather than
  printing RD$0.
