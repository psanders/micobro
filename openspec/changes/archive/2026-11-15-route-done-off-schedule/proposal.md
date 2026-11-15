# Proposal

## Why

Mi ruta's "Hechas" left out payments collected today on loans that weren't
due today. Crédito abierto was hit hardest: its interest falls due once per
cycle, so interest paid early or capital paid mid-cycle never showed as
Hecha, nor in the route's collected total. Term loans lost early cuotas.
Mi ruta also never reloaded when the tab came back into focus, so a cobro
could stay "Pendiente" until the app restarted. The lender docs
(`docs-site/guias/ruta.mdx`) already say Hechas are "Las que ya resolviste
hoy". Issue #223.

## What Changes

- An active loan whose next payment isn't due yet but that has a payment
  recorded today gets a `done` visit for the amount collected. It counts in
  the goal and in the collected total like any other visit and sorts after
  the due and overdue visits.
- Mi ruta reloads today's route every time its tab gains focus.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `route-view`: adds "Off-schedule collections on the route".

## Impact

No schema, Sheet or money-math change. Inicio and Perfil read the same
`RouteDay`, so a cobro on a loan not due today now also counts in their
collected figures.
