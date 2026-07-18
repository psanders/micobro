# Ship checkpoint — sheet-provisioning  ✅ DONE

Started: 2026-07-17
Current stage: 6 — Archive (complete)

**Scope:** On the first successful Google connect, provision the lender's backup
in their own Drive — a `Micobro` folder containing a `Datos` spreadsheet with the
Clientes/Préstamos/Pagos/Visitas tabs (headers matching push.ts ranges) — store its
id via setSheetId, then backfill queued local data. Idempotent: reuse a stored id or
re-find the folder/sheet by name across reinstalls rather than duplicating.

**Detected surfaces:** OpenSpec: yes · Pencil: yes · Storybook: yes · E2E: Maestro

| # | Stage | Status | Notes |
| :- | :--- | :--- | :--- |
| 0 | Frame | done | Surfaces detected; branch feat/sheet-provisioning; artifacts authored |
| 1 | Design (Pencil) | skipped | No new screens — provisioning runs behind the existing Conectar "connecting" spinner |
| 2 | Spec reconcile | done | No Pencil design → no drift; delta validates |
| 3 | Build | done | ENTITY_RANGES exported; sheetsClient Drive/Sheets helpers; provisionSheet.ts; wired into real connect() |
| 4 | Test | done | 5 unit tests; full suite 247 pass; typecheck + main-tree lint clean. On-device: real Micobro/Datos created in Drive (Clientes A:F headers verified), Conectado |
| 5 | Sync | done | Delta promoted into openspec/specs/google-connect; 14 specs validate |
| 6 | Archive | done | Moved to openspec/changes/archive/2026-07-17-sheet-provisioning |

## Verified on-device (2026-07-17)
- Drive API + Sheets API already enabled; drive.file granted at runtime (Testing mode).
- Real spreadsheet created: id 1XD2bzEXPhJ-Fg7tt9Nwav9aB1jGp1efH_pq7EDXJl-Y in Micobro folder.
- Tabs Clientes/Préstamos/Pagos/Visitas present; default sheet removed; Clientes header = ID/Nombre/Teléfono/Dirección/Creado/Actualizado.

## Open items (not blocking archive)
- Task 1.3: register drive.file scope on the OAuth consent screen before OAuth verification / production.
- Git: branch feat/sheet-provisioning still uncommitted (google-signin pivot + this change). Commit/PR pending user request.
- Stray worktree .claude/worktrees/agent-a44c3238833f865ea — removal blocked by classifier; leave for user.

## Decision log

Newest first.

- 2026-07-17 — Stage 6 Archive done. Ship complete.
- 2026-07-17 — Stage 5 Sync done: delta promoted to main google-connect spec; validates.
- 2026-07-17 — Stage 4 verified on-device: real Micobro/Datos provisioned; unit suite green.
- 2026-07-17 — Stage 3 Build done: provisionSheet + Drive/Sheets helpers wired into connect().
- 2026-07-17 — Stage 1 skipped (no UI). Spec reconcile done.
- 2026-07-17 — Naming settled: folder `Micobro`, spreadsheet `Datos`.
- 2026-07-17 — Checkpoint created.
