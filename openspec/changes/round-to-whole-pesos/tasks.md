## 1. Rounding rule

- [ ] 1.1 Add `roundToPeso(cents)` to `lib/utils/money.ts` (nearest peso, halves up) and use it in `loanMath.ts` in place of the private `roundToNearestPeso`
- [ ] 1.2 Round `totalInterestCents` in `loanMath.ts` to the peso
- [ ] 1.3 Round mora in `lib/loans/mora.ts` to the peso (apply before the `minCents` floor; keep the floor a whole peso)
- [ ] 1.4 Round crédito abierto interest in `lib/loans/openCredit.ts` (all three `Math.round(balance * rate)` sites) to the peso

## 2. Input and formatting

- [ ] 2.1 Make `parseAmountToCents` return `null` for any decimal part; keep separators and the "RD$" prefix
- [ ] 2.2 Show a Spanish "Solo pesos enteros" error in the amount inputs of `CollectPaymentScreen`, `VisitOutcomeScreen`, `CuadreScreen` and `NewLoanFormScreen`
- [ ] 2.3 Remove the cents branch from `formatCurrency` and `formatAmount`
- [ ] 2.4 Replace the hand-rolled `/ 100` + `toLocaleString` in `LoanDetailScreen`, `CollectPaymentScreen` and `PaymentHistoryScreen` with the shared formatters
- [ ] 2.5 Make `formatRD` in `lib/printer.ts` print whole pesos via the shared formatter

## 3. Tests

- [ ] 3.1 `money`: `roundToPeso` halves, `parseAmountToCents` rejects decimals and accepts separators, formatters never emit decimals
- [ ] 3.2 `loanMath`, `mora`, `openCredit`: scenarios from the spec (12.5% on RD$1,001; mora RD$36.83 → RD$37; RD$10,333 at 10%)
- [ ] 3.3 Receipt bytes contain no ".00"
- [ ] 3.4 Sync push still sends the stored value unchanged
- [ ] 3.5 Run `npm test`, lint and typecheck

## 4. Verify

- [ ] 4.1 Walk a loan through create → collect → history on the emulator and confirm no centavos appear anywhere
