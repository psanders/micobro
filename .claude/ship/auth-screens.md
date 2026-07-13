# Ship checkpoint — auth-screens

Started: 2026-07-13
Current stage: done — archived as 2026-07-13-auth-screens

**Scope:** Rebuild the three authentication screens (Configura tu PIN `EYzn2`,
Desbloquear `Jy3HY`, Conectar con Google `S2oEG8`) pixel-close to the Pencil
designs on the mock client, replacing the basic navy versions; wire all
navigation as production (pin → sync → tabs, unlock → tabs, Settings →
conectar re-entry). First of the per-group screen changes (home/nav,
collection flow, profile/settings follow as separate changes).

**Detected surfaces:** OpenSpec: yes · Pencil: yes (`pencil.pen`) · Storybook: yes (`.storybook/`, @storybook/react-native) · E2E: yes (Maestro `.maestro/`, no Playwright)

| #   | Stage           | Status | Notes                                                                                                                                                             |
| :-- | :-------------- | :----- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done   | Change created via `openspec new change`; proposal/design/specs/tasks written; `openspec validate` green                                                          |
| 1   | Design (Pencil) | done   | User approved all three screens as-is; forgot-PIN = info dialog                                                                                                   |
| 2   | Spec reconcile  | done   | No behavior change at design gate; specs already match; validate green                                                                                            |
| 3   | Build           | done   | Tokens (`lib/ui/theme.ts`), Jakarta Sans fonts, ProfileRepo, PinInput/PinKeypad/PinScreen/BrandLogo + stories, 3 screens rebuilt, all links wired, tasks.md 13/13 |
| 4   | Test            | done   | tsc + eslint + jest (28/28) green; Maestro launch flow PASSES with DEV_URL deep link (dev builds); full flow walked on emulator incl. error states                |
| 5   | Sync            | done   | app-lock + google-connect promoted to openspec/specs/ (agent-driven merge)                                                                                        |
| 6   | Archive         | done   | `openspec archive auth-screens --yes --skip-specs` → archive/2026-07-13-auth-screens                                                                              |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-07-13 — User approved sync+archive directly to main (WIP phase). Specs promoted, change archived. Next group: home/navigation.

- 2026-07-13 — Stage 4 done. Maestro flow made dev-client-aware: optional DEV_URL deep link (flow-level `env:` default overrides CLI `-e` in Maestro, so no default is set; branch cleanly skips when DEV_URL is omitted). Verified pass with DEV_URL; release builds need no flag.
- 2026-07-13 — Stage 3 done. On-device verification of every spec scenario: fresh-boot → Crea tu PIN, confirm→Google, mock connect→tabs, relaunch→Desbloquear (Carlos avatar via mock ProfileRepo), wrong-PIN error, unlock, Ajustes→Conectar→X→back.
- 2026-07-13 — ConnectGoogleScreen simplified to `{onDone}` prop (design copy is fixed); mock mode bypasses promptAsync and calls syncRepo.connect with stub params.
- 2026-07-13 — Avatar assets mapped via `components/avatars.ts` + `types/assets.d.ts` (ESM png imports; repo layer stays UI-free with semantic `avatarKey`).
- 2026-07-13 — Design gate passed: screens approved unchanged; forgot-PIN interim = informational dialog. Stages 1–2 done, entering build.
- 2026-07-13 — User decisions: Pencil is the spec (full replacement incl. tab structure later); ALL screens mock-backed; one OpenSpec change per screen group.
- 2026-07-13 — New capabilities: `app-lock`, `google-connect` (first promoted specs in this repo).
- 2026-07-13 — ProfileRepo added to design so Desbloquear's "Hola, Carlos." greeting is data-driven (mock: Carlos; real: null → logo fallback).
- 2026-07-13 — Open question for design gate: forgot-PIN behavior (no designed recovery screen; interim = informational dialog).
- 2026-07-13 — Checkpoint created; framing the change.
