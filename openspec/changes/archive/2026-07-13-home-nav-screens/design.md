# Design: home-nav-screens

## Context

Auth group shipped the brand foundations (`lib/ui/theme.ts`, Plus Jakarta
Sans, BrandLogo). This group replaces the placeholder tab shell with the
designed one and builds the three navigation screens from `pencil.pen`:
`cuW2F` (02 Home "Hoy"), `f006Rz` (03 Mi Ruta), `p2s52` (04 Buscar), plus
the `m/tabbar`, `m/client-row`, `m/quick-action`, `m/progress-bar`,
`m/chip`, `m/section-label`, `m/input`, `m/list-tile` library components.

## Goals / Non-Goals

**Goals:**

- Pixel-close Hoy / Mi Ruta / Buscar on the mock client; designed tab shell.
- Every link wired: quick actions → tabs, Ver todas → Ruta, visit/client
  rows → existing customer/loan details, avatar → settings, search → results.
- Real client degrades honestly: empty route day, search over real customers.

**Non-Goals:**

- No visits/route DB domain — real `RouteRepo` returns an empty day; the
  domain gets its own OpenSpec change later.
- Cuadre screen content (own group); customer/loan detail redesigns (own
  group); recording payments from the route (collection-flow group).

## Decisions

- **Tab shell via expo-router Tabs, custom-styled** — keep the existing
  `(tabs)` group but rename routes to `index` (Hoy), `ruta`, `buscar`,
  `cuadre`; style with Feather icons (lucide equivalents: house→home,
  map→map, search→search, calculator — Feather lacks calculator, use
  MaterialCommunityIcons "calculator-variant-outline") and brand tints.
  Header hidden on all tabs (screens own their headers, as designed).
- **`RouteRepo` shape** — structured fields, labels computed in the UI:
  `getToday(): Promise<RouteDay>` with
  `RouteDay { date, goalCents, collectedCents, clientCount, pendingCount, visits[] }`,
  `RouteVisit { id, customerId, name, business, address, avatarKey, amountCents,
hasMora, status: "pending"|"overdue"|"done"|"promise", overdueDays?,
paidAt?, promiseNote?, installmentLabel? }`. Mock seeds the design's exact
  dataset (Felipe, José, María Rosa, Pedro, Luis, Ana, Ramón). Real returns
  a zeroed day with no visits — Home hero shows RD$0 and the visits section
  shows its empty state.
- **`CustomerRepo.search(query)`** — returns
  `{ id, name, avatarKey, inMora, loanCount }[]`; empty query returns all
  (the "MIS CLIENTES" list). Real implementation filters `customers` by
  name/phone substring and counts loans per customer with the existing
  drizzle tables — a new `searchCustomers` validated function following the
  factory pattern. Mock filters its fixtures.
- **Recent searches** — device-local UX state, not domain data: a small
  AsyncStorage-backed helper (`lib/search/recentSearches.ts`, max 5,
  most-recent-first, removable), shared by both repo modes.
- **Presentational components** (Storybook-first): `ClientRow` (avatar,
  name, optional business line, meta line, trailing amount + sub-label,
  done/overdue variants), `QuickAction`, `ProgressBar`, `FilterChip`,
  `SectionLabel`, `SearchInput`. All use `lib/ui/theme.ts` tokens.
- **Settings relocation** — the Home avatar button opens the existing
  sync-settings screen as a stack route (`/ajustes`); the google-connect
  spec's "Settings tab" wording updates via delta to "settings screen".
  The Perfil group later replaces this screen wholesale.
- **Connection pill** — driven by `SyncRepo.getStatus().connected`
  ("Conectado" green pill vs "Sin conexión" neutral pill); date label from
  `new Date()` formatted es-DO.

## Risks / Trade-offs

- [Old list screens removed from tabs] Deep links to `/customers`/`/loans`
  tabs die → routes deleted in the same change; detail routes stay.
- [Real route is empty] Home hero reads RD$0/RD$0 on real client → accepted
  and specced; honest until the visits domain exists.
- [Feather lacks a calculator glyph] → MaterialCommunityIcons variant for
  the Cuadre tab/quick-action keeps the metaphor.

## Open Questions

- None blocking; Cuadre placeholder copy proposed as "Cuadre general —
  disponible pronto" with the designed empty-state styling.
