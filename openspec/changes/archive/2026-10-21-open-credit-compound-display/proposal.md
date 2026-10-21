## Why

Crédito abierto capitalizes unpaid interest: when a cycle ends unpaid, its interest is added to the balance. Every screen and receipt labels that single balance "capital", so a customer who borrowed RD$10,000 and missed one month sees "Capital pendiente RD$11,000" and believes their loan grew. Lenders like the math; customers are confused by how it is presented.

## What Changes

- The balance is always shown as two parts that add up to it exactly: **capital pendiente** (what was lent minus capital paid down — never above the principal) and **intereses sumados** (unpaid interest added to the balance and not yet paid off). The engine's totals, interest and capitalization are unchanged.
- Money paid beyond a cycle's interest clears intereses sumados first, then capital. This only decides which part is shown going down; the total owed is identical either way.
- Loan detail: the headline is capital pendiente with "Prestado RD$X"; intereses sumados and "Para saldar hoy" appear only when there is capitalized interest; the next interest notes it is charged on capital + intereses sumados; a skipped cycle reads "Ciclo N · No pagado — RD$X se sumó al saldo".
- Collect: the banner shows capital and intereses sumados separately; "Interés + capital" / "Solo capital" become "Interés + abono" / "Solo abono"; "Después del pago" shows capital and intereses sumados separately.
- Customer card: "Capital pagado %" is based on capital pendiente, so it never goes backwards.
- Receipts (on screen, shared image, printed): lines read "Interés · ciclo N", "Intereses sumados", "Abono a capital", followed by "Después de este pago" (capital pendiente, intereses sumados, próximo interés). The receipt shown at collection and one rebuilt from history are derived the same way and always match.
- The loan type picker reads "Crédito abierto (compuesto)".

## Capabilities

### New Capabilities

- `open-credit-presentation`: How a crédito abierto (compuesto) balance, payments and receipts are presented as capital vs intereses sumados.

### Modified Capabilities

(none — existing loan-detail / collect-payment requirements stay valid; this adds presentation rules on top)

## Impact

- `lib/loans/openCredit.ts`: the replay also tracks intereses sumados; new `openCreditReceiptBreakdown`.
- `lib/payments/collectPayment.ts`, `lib/loans/loanViews.ts` (`buildPaymentReceipt`, customer summary), repo types and mock.
- Screens: loan detail, collect, receipt summary/view, printer, payment confirmed/receipt routes.
- `.maestro/credito-abierto-solo-capital.yaml` label updates.
- No schema or sync changes.
