# services/backoffice — Phase 1 Fineract proof of concept (`@micobro/backoffice`)

Not shipped in the app, and nothing under `app/`, `components/` or `lib/`
imports it. It's a proof of concept for connecting Micobro to a back office
built on Apache Fineract. The findings are in **[GAP-ANALYSIS.md](GAP-ANALYSIS.md)**. The wire contract
lives in its own workspace, `packages/contract` (`@micobro/contract`).

```
client/fakeMicobroClient.ts     the app, using its real loan/mora code
server/backoffice.ts            the BFF: applies mutations to Fineract
server/mapping.ts               Micobro concept → Fineract request
fineract/port.ts                the Fineract API slice in use
fineract/model.ts               Fineract's schedule, allocation and mora rules (pure)
fineract/fakeFineract.ts        in-memory Fineract on the model (used by npm test)
fineract/httpFineract.ts        the same port over a real server
fineract/calibration.ts         probes that keep the fake honest
fineract/observed.json          what the real server returned
fineract/compose.yaml           local Fineract + Postgres
```

## Run

```sh
npm test -- services/backoffice       # fake only, no Docker needed
npm run backoffice:up                 # Fineract on :8088 (first boot ~1 min)
npm run backoffice:live               # same suites against the real server
npm run backoffice:reset              # wipe Fineract's data (the mora job slows as test loans pile up)
npm run backoffice:provision -- acme "Acme Préstamos"   # a new lending business = its own tenant + database
FINERACT_TENANT=acme npm run backoffice:live            # run the live suite on that tenant
npm run backoffice:down
```

The live run rewrites `fineract/observed.json`. If a probe's result
changes, FakeFineract no longer matches the real server. Fix the fake
before you trust the scenarios again.

## Write a scenario

```ts
const { app, backoffice, today } = await setup();
const customerId = app.createCustomer({ name: "María", phone: phone() });
const loanId = app.createLoan({ ...SAN, customerId });
await today(2026, 1, 28); // device clock + the back office's nightly close
app.collect(loanId, 2035); // 3 late cuotas + their mora
const res = await app.sync(); // one batch, per-mutation results
expect(res.results[0].status).toBe("applied");
expect((await stateOf(backoffice, app, loanId)).moraCents).toBe(0);
```
