# Proposal: home-nav-screens

## Why

With authentication shipped, the app still lands on the placeholder navy tab
shell (Inicio/Clientes/Préstamos/Ajustes). The Pencil designs define a
collector-centric shell — tabs Hoy / Ruta / Buscar / Cuadre — and the three
navigation screens that make the app feel like the real product. This is the
second per-group screens change, all against the mock client.

## What Changes

- **Replace the tab shell**: Inicio/Clientes/Préstamos/Ajustes →
  Hoy / Ruta / Buscar / Cuadre per the `m/tabbar` design (lucide-style icons,
  brand-deep active state). **BREAKING** for the old Clientes/Préstamos tabs —
  their list screens are superseded by Buscar and Mi Ruta; detail screens stay
  routed until the collection-flow group replaces them.
- **02 Home (Hoy)** (`cuW2F`): date + connection pill, "Hola, Carlos."
  greeting with initials button, "Meta de hoy" hero card (collected vs goal,
  percent pill, progress bar, clientes/pendientes), quick actions
  (Mi ruta / Buscar / Cuadre), and "Próximas visitas" list with per-visit
  status.
- **03 Mi Ruta** (`f006Rz`): day header with visit count, filter chips
  (Todas/Pendientes/Atrasadas/Vencidos/Hechas), and the full visit list with
  overdue/done/promise states.
- **04 Buscar** (`p2s52`): search by name/phone/cédula, recent searches, and
  the "Mis clientes" list with per-customer status.
- **New data surfaces on the repo seam** (mock-backed; real returns empty
  until the domains exist): `RouteRepo.getToday()` for the meta/visits, and
  `CustomerRepo.search()` for Buscar.
- **Transitional wiring** so nothing dead-ends: Cuadre tab shows a designed
  empty state until the Cuadre group lands; the old Ajustes content (sync
  settings + lock) moves behind the Home avatar button so google-connect
  re-entry keeps working.

## Capabilities

### New Capabilities

- `app-navigation`: the Hoy/Ruta/Buscar/Cuadre tab shell, active-tab
  styling, and transitional destinations (Cuadre placeholder, settings via
  the Home avatar).
- `home-dashboard`: the Hoy screen — greeting/connection status, meta-de-hoy
  summary, quick actions, and próximas visitas.
- `route-view`: the Mi Ruta screen — day summary, status filter chips, and
  the visit list with its states.
- `customer-search`: the Buscar screen — query matching, recent searches,
  and the customer list with status.

### Modified Capabilities

<!-- google-connect re-entry point moves from a Settings *tab* to the
     settings screen reached via the Home avatar — the requirement text says
     "Settings tab"; see delta. -->

- `google-connect`: re-entry location changes from the Settings tab to the
  settings screen opened from the Home avatar (tab no longer exists).

## Impact

- `app/(tabs)/*` — restructured to index (Hoy) / ruta / buscar / cuadre;
  customers/loans list tabs removed.
- `components/screens/` — new HomeScreen, RouteScreen, SearchScreen,
  CuadrePlaceholder; old DashboardScreen/CustomerListScreen/LoanListScreen
  retired from tabs.
- `lib/repo/types.ts` + real/mock — `RouteRepo`, `CustomerRepo.search`.
- New presentational components: ClientRow, QuickAction, ProgressBar, Chip,
  SectionLabel, tab bar styling — with Storybook stories.
- No DB schema changes; real `RouteRepo` returns an empty day until a
  visits/route domain is proposed separately.
