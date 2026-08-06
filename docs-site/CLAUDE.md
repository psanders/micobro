# Micobro docs — editorial policy

Project-specific guidance for everything under `docs-site/` (the Mintlify docs and their
assets). Authored with `/ps:docs`. This is the _what's-allowed-and-for-whom_ layer; the
_how-to-write_ method lives in the skill, the coding conventions in the repo-root
`CLAUDE.md`, and the asset mechanics in `images/ASSETS.md` — don't restate those here.

## Scope — the Android app only

These docs describe **the Micobro Android app**. There is exactly one audience: **the
prestamista who uses it** — an independent lender in the Dominican Republic tracking their
own customers, loans, and collections from a phone.

There is no developer reader, no API, and no SDK. There is nothing to deploy: the app runs
on the lender's phone and the lender owns the Google Sheet it syncs to. If a page starts
explaining something a lender cannot see or touch, it is the wrong page.

## Language — Spanish

Write all docs in **Spanish**: prose, headings, frontmatter `title` / `description`, image
`alt` text, and callouts. This matches the repo-root rule that all user-facing text is
Spanish, and it matches the users — Dominican lenders.

Keep the app's own wording exactly as it appears on screen, because the reader is looking at
it while they read: **Hoy**, **Ruta**, **Buscar**, **Cuadre**, **Tradicional**, **Crédito
Abierto**, **Solo interés**, **Interés + capital**, **Saldar préstamo**, **Mora**, **Promesa
de pago**, **Sin contacto**, **No quiere pagar**. Never translate or "improve" a label — if
the docs and the screen disagree, the screen wins and the docs get fixed.

**No em-dashes in doc prose.** In Spanish they read as an English/AI-writing tell, not native
punctuation. Use a colon, comma, or parentheses. This applies to `.mdx` prose (including
`alt` and caption text), not to this file or other internal Markdown, which stay in English.

## Voice

Second person, present-tense imperative, active, short sentences, task-first. Write the way
you would explain it standing next to someone holding the phone. Assume the reader knows
lending cold and knows phones less well: never explain what mora or capital is, do explain
where to tap.

No jargon from the codebase, no English technical words where a plain Spanish one exists.

## Out of scope — never document

- **The implementation.** SQLite, drizzle, the `pending_mutations` queue, Expo/React Native,
  the validated-function pattern, Zod, the repo layout, tests.
- **The sync mechanism.** OAuth, PKCE, tokens, the Sheets REST API, retry and queue
  behavior. The lender connects a Google account and their data shows up in a spreadsheet:
  that is the whole story they need.
- **Anything unreleased.** Pull/two-way sync and conflict resolution are not built. Don't
  describe them as if they were, and don't promise dates.

## The disclosure rule

> _Does the lender tap it, see it, or get a result from it?_ If yes, document it. If it is
> only _how we built or run it_, leave it out — and where you must refer to it, describe the
> **behavior**, not the **mechanism**.

### OK vs too much

✅ "Micobro guarda todo en tu teléfono al momento. Cuando vuelve la señal, sube lo nuevo a tu
hoja de Google."

❌ "Las mutaciones se encolan en `pending_mutations` y `push.ts` las reproduce contra la API
de Sheets v4 usando un token obtenido por PKCE."

## Money, dates, and examples

- Money in Dominican pesos, written as the app writes it: `RD$5,000`.
- Realistic Dominican names, places, and phone formats in examples (`Ramona Peña`,
  `809-555-0134`). Never `John Doe`, never `+1 555 0100`.
- Never put a real customer's data, a real phone number, or a real Google account in a page
  or a screenshot. Blur or replace before publishing.

## Assets

Screenshots and diagrams obey the same rules: no internals, no real customer data. Register
every asset in `images/ASSETS.md` with where it came from and when, so a stale screenshot can
be traced back and retaken after a UI change.
