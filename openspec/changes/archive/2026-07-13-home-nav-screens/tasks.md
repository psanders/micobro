# Tasks: home-nav-screens

## 1. Data seam

- [x] 1.1 Add `RouteRepo` (`getToday(): Promise<RouteDay>`) + `RouteDay`/`RouteVisit` types to `lib/repo/types.ts`; mock seeds the design dataset; real returns an empty zeroed day
- [x] 1.2 Add `CustomerRepo.search(query)` returning `{id, name, avatarKey, inMora, loanCount}`; new `searchCustomers` validated function for real (drizzle filter + loan count); mock filters fixtures
- [x] 1.3 `lib/search/recentSearches.ts` — AsyncStorage-backed, max 5, MRU, remove(entry); Jest test
- [x] 1.4 Wire `useRouteRepo` through RepoProvider

## 2. Components (Storybook-first)

- [x] 2.1 `ClientRow` (avatar/initials, name, business?, meta line, amount + sub-label, done/overdue/compact variants) + stories
- [x] 2.2 `QuickAction`, `ProgressBar`, `FilterChip`, `SectionLabel`, `SearchInput` + stories

## 3. Screens & shell

- [x] 3.1 Tab shell: `(tabs)` → index (Hoy) / ruta / buscar / cuadre with designed icons/tints; delete customers/loans tab routes
- [x] 3.2 `HomeScreen` (Hoy): header (date, connection pill, greeting, avatar button → /ajustes), Meta de hoy card, quick actions, próximas visitas + Ver todas, empty states
- [x] 3.3 `RouteScreen` (Mi Ruta): header w/ counts, filter chips with live counts, visit list w/ overdue/done/promise treatments, empty state
- [x] 3.4 `SearchScreen` (Buscar): search input, recent searches (tap/re-run/remove), MIS CLIENTES list, no-matches state
- [x] 3.5 `CuadrePlaceholderScreen`; `/ajustes` stack route hosting SyncSettingsScreen; retire DashboardScreen/CustomerListScreen/LoanListScreen from tabs

## 4. Tests & gates

- [x] 4.1 Jest: searchCustomers (match/no-match/validation failure), recentSearches (MRU/max5/remove), mock RouteRepo shape, real RouteRepo empty day
- [x] 4.2 lint/typecheck/test green; walk Hoy→Ruta (filters)→Buscar (search/recents)→Cuadre→ajustes on emulator with mock client; verify real-mode empty states via expo export or emulator without mock flag
- [x] 4.3 Keep Maestro smoke green (copy unchanged: "Crea tu PIN")
