# Proposal

## Why

Mi ruta's "Vencidos" chip listed loans more than 5 days late on their oldest
cuota, not loans past their end date. A loan whose term ended a few days ago
sat under "Atrasadas", while a mid-term loan 6+ days late showed "Venció
hace N días" although its receipt prints a future "Vencimiento". The lender
docs (`docs-site/guias/ruta.mdx`) already say Vencidos are "Préstamos que ya
pasaron de su fecha". Issue #215.

## What Changes

- A route visit is vencido when it isn't collected today and the start of
  today is after the start of its loan's end date — the same end date the
  receipt prints as "Vencimiento". Open credit has no end date and is never
  vencido.
- "Vencidos" lists exactly those visits; "Atrasadas" lists every other
  overdue visit, however late. The 5-day threshold is gone.
- A vencido row reads "Venció hace N días" (singular "1 día"), counting
  from the end date.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `route-view`: "Status filter chips" defines Vencidos and Atrasadas.

## Impact

No schema, Sheet or money-math change. The Hoy screen still shows days late
from the oldest cuota.
