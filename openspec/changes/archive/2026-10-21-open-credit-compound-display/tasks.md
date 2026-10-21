## 0. Design gate

- [x] 0.1 Pencil: 06c' loan detail, 07c' collect, 12' receipt in "Crédito abierto (compuesto)" section
- [x] 0.2 Pedro approves the designs

## 1. Engine

- [x] 1.1 `openCreditState` tracks intereses sumados; returns `principalBalanceCents` + `capitalizedInterestCents` (sum = balance); per-cycle `capitalizedCents`, `capitalizedPaidCents`, `principalPaidCents`
- [x] 1.2 `openCreditReceiptBreakdown`: lines + "después de este pago" from replaying before/after the payment
- [x] 1.3 Tests: split invariants, abono order, overpay clamp, receipt breakdown, reprint equals collect

## 2. Data

- [x] 2.1 `OpenCreditView` carries the split (detail, collect context, mock)
- [x] 2.2 Customer card `capitalPaidRatio` uses capital pendiente
- [x] 2.3 `collectPayment` and `buildPaymentReceipt` use the engine breakdown for crédito abierto; `PaymentReceipt.balanceAfter`

## 3. UI

- [x] 3.1 Loan detail: capital headline, intereses sumados, para saldar, interest note, skipped-cycle wording, "Compuesto" chip
- [x] 3.2 Collect: split banner, "Interés + abono" / "Solo abono", split after-payment preview
- [x] 3.3 Receipt card, shared image and printer show "Después de este pago"
- [x] 3.4 Loan type picker reads "Crédito abierto (compuesto)"
- [x] 3.5 Maestro flow labels updated

## 4. Verify

- [x] 4.1 Emulator: crédito abierto with a missed cycle — detail, collect, receipt, reprint

## 5. Grace days, ponerse al día, delivery date

- [x] 5.1 Engine: grace days per loan (null = 5 for crédito abierto, 0 = none); cycle windows end at due + grace; `nextGraceEndDate`, `catchUpCents`
- [x] 5.2 Tests: grace scenarios, legacy default, catch-up amounts; synthetic reference model with grace 0–5 over 2,000 histories
- [x] 5.3 Pay options: "catch_up" option, pre-selected when intereses sumados > 0
- [x] 5.4 Collect: PARA PONERSE AL DÍA card + breakdown, "Ponerse al día" option, "Solo interés del ciclo" warning, grace in banner
- [x] 5.5 Detail: grace chip, "Próx. pago … · gracia hasta …", "Para ponerse al día" row
- [x] 5.6 Form: "Días de gracia" switch (off → 0) with days field (5), delivery-date hint under Primer pago
- [x] 5.7 Emulator walkthrough
- [x] 5.8 Default grace changed to 5 days (Pedro); printed receipt never truncates amounts (label shortens instead); "Próx. interés DD/MM" label
- [x] 5.9 Break the loanViews ↔ openCredit require cycle (`lib/loans/frequency.ts`)
