/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */

/** Lowercases and strips diacritics so "ramon" matches "Ramón". */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Strips everything but digits \u2014 the normalization stored in the DB. */
export function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

/** "8295550143" \u2192 "829-555-0143"; anything else passes through untouched. */
export function formatPhone(value: string): string {
  const digits = normalizePhone(value);
  if (digits.length !== 10) return value;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Live formatter for a TextInput's onChangeText: inserts the "-" delimiters
 * of "XXX-XXX-XXXX" progressively as digits are typed, rather than only
 * once all 10 digits are present. Re-derives the mask from the current
 * digits on every keystroke (instead of tracking cursor/previous state), so
 * it's naturally robust to backspace/deletion anywhere in the string.
 * Extra digits past 10 are dropped.
 */
export function formatPhoneInput(value: string): string {
  const digits = normalizePhone(value).slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * CP858 ("codepage 850, Multilingual Latin I" + euro sign) encode table for
 * bytes 0x80-0xFF, keyed by Unicode code point. ESC/POS thermal printers
 * render raw bytes through a single-byte code page instead of decoding
 * UTF-8, so `encodeCp858` below (paired with the `ESC t 19` select-code-page
 * command in lib/printer.ts) is what makes accented Dominican Spanish print
 * as the intended glyph instead of UTF-8 mojibake. Values were cross-checked
 * against Python's built-in `cp858` codec, the reference implementation.
 */
const CP858_ENCODE: ReadonlyMap<number, number> = new Map([
  [0x00c7, 0x80], // Ç
  [0x00fc, 0x81], // ü
  [0x00e9, 0x82], // é
  [0x00e2, 0x83], // â
  [0x00e4, 0x84], // ä
  [0x00e0, 0x85], // à
  [0x00e5, 0x86], // å
  [0x00e7, 0x87], // ç
  [0x00ea, 0x88], // ê
  [0x00eb, 0x89], // ë
  [0x00e8, 0x8a], // è
  [0x00ef, 0x8b], // ï
  [0x00ee, 0x8c], // î
  [0x00ec, 0x8d], // ì
  [0x00c4, 0x8e], // Ä
  [0x00c5, 0x8f], // Å
  [0x00c9, 0x90], // É
  [0x00e6, 0x91], // æ
  [0x00c6, 0x92], // Æ
  [0x00f4, 0x93], // ô
  [0x00f6, 0x94], // ö
  [0x00f2, 0x95], // ò
  [0x00fb, 0x96], // û
  [0x00f9, 0x97], // ù
  [0x00ff, 0x98], // ÿ
  [0x00d6, 0x99], // Ö
  [0x00dc, 0x9a], // Ü
  [0x00f8, 0x9b], // ø
  [0x00a3, 0x9c], // £
  [0x00d8, 0x9d], // Ø
  [0x00d7, 0x9e], // ×
  [0x0192, 0x9f], // ƒ
  [0x00e1, 0xa0], // á
  [0x00ed, 0xa1], // í
  [0x00f3, 0xa2], // ó
  [0x00fa, 0xa3], // ú
  [0x00f1, 0xa4], // ñ
  [0x00d1, 0xa5], // Ñ
  [0x00aa, 0xa6], // ª
  [0x00ba, 0xa7], // º
  [0x00bf, 0xa8], // ¿
  [0x00ae, 0xa9], // ®
  [0x00ac, 0xaa], // ¬
  [0x00bd, 0xab], // ½
  [0x00bc, 0xac], // ¼
  [0x00a1, 0xad], // ¡
  [0x00ab, 0xae], // «
  [0x00bb, 0xaf], // »
  [0x2591, 0xb0], // ░
  [0x2592, 0xb1], // ▒
  [0x2593, 0xb2], // ▓
  [0x2502, 0xb3], // │
  [0x2524, 0xb4], // ┤
  [0x00c1, 0xb5], // Á
  [0x00c2, 0xb6], // Â
  [0x00c0, 0xb7], // À
  [0x00a9, 0xb8], // ©
  [0x2563, 0xb9], // ╣
  [0x2551, 0xba], // ║
  [0x2557, 0xbb], // ╗
  [0x255d, 0xbc], // ╝
  [0x00a2, 0xbd], // ¢
  [0x00a5, 0xbe], // ¥
  [0x2510, 0xbf], // ┐
  [0x2514, 0xc0], // └
  [0x2534, 0xc1], // ┴
  [0x252c, 0xc2], // ┬
  [0x251c, 0xc3], // ├
  [0x2500, 0xc4], // ─
  [0x253c, 0xc5], // ┼
  [0x00e3, 0xc6], // ã
  [0x00c3, 0xc7], // Ã
  [0x255a, 0xc8], // ╚
  [0x2554, 0xc9], // ╔
  [0x2569, 0xca], // ╩
  [0x2566, 0xcb], // ╦
  [0x2560, 0xcc], // ╠
  [0x2550, 0xcd], // ═
  [0x256c, 0xce], // ╬
  [0x00a4, 0xcf], // ¤
  [0x00f0, 0xd0], // ð
  [0x00d0, 0xd1], // Ð
  [0x00ca, 0xd2], // Ê
  [0x00cb, 0xd3], // Ë
  [0x00c8, 0xd4], // È
  [0x20ac, 0xd5], // € (this is the one byte where CP858 differs from CP850)
  [0x00cd, 0xd6], // Í
  [0x00ce, 0xd7], // Î
  [0x00cf, 0xd8], // Ï
  [0x2518, 0xd9], // ┘
  [0x250c, 0xda], // ┌
  [0x2588, 0xdb], // █
  [0x2584, 0xdc], // ▄
  [0x00a6, 0xdd], // ¦
  [0x00cc, 0xde], // Ì
  [0x2580, 0xdf], // ▀
  [0x00d3, 0xe0], // Ó
  [0x00df, 0xe1], // ß
  [0x00d4, 0xe2], // Ô
  [0x00d2, 0xe3], // Ò
  [0x00f5, 0xe4], // õ
  [0x00d5, 0xe5], // Õ
  [0x00b5, 0xe6], // µ
  [0x00fe, 0xe7], // þ
  [0x00de, 0xe8], // Þ
  [0x00da, 0xe9], // Ú
  [0x00db, 0xea], // Û
  [0x00d9, 0xeb], // Ù
  [0x00fd, 0xec], // ý
  [0x00dd, 0xed], // Ý
  [0x00af, 0xee], // ¯
  [0x00b4, 0xef], // ´
  [0x00ad, 0xf0], // (soft hyphen)
  [0x00b1, 0xf1], // ±
  [0x2017, 0xf2], // ‗
  [0x00be, 0xf3], // ¾
  [0x00b6, 0xf4], // ¶
  [0x00a7, 0xf5], // §
  [0x00f7, 0xf6], // ÷
  [0x00b8, 0xf7], // ¸
  [0x00b0, 0xf8], // °
  [0x00a8, 0xf9], // ¨
  [0x00b7, 0xfa], // ·
  [0x00b9, 0xfb], // ¹
  [0x00b3, 0xfc], // ³
  [0x00b2, 0xfd], // ²
  [0x25a0, 0xfe] // ■
  // 0xFF (NBSP, U+00A0) is intentionally omitted: NBSP is collapsed to a
  // plain space by UNICODE_SPACE_RE below before this table is consulted.
]);

/**
 * Unicode space separators that ICU's `Intl`/`toLocaleString` formatters
 * (used for the es-DO date/time and currency strings on the receipt) emit
 * but CP858 has no sane single-byte glyph for: U+00A0 NO-BREAK SPACE and
 * U+202F NARROW NO-BREAK SPACE around "a. m."/"p. m.", plus the rest of the
 * Unicode space-separator block. All collapse to a plain ASCII space.
 */
const UNICODE_SPACE_RE = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;

/**
 * Zero-width characters, BOM, bare combining marks, and C0/DEL control
 * characters — none have a printable ESC/POS representation, so they're
 * dropped rather than mapped to "?" (which would be misleading).
 */
// Intentional: C0/DEL control bytes must never reach the printer raw, so
// they're stripped here.
// eslint-disable-next-line no-control-regex
const DROP_RE = /[\u0300-\u036F\u200B-\u200D\uFEFF\x00-\x08\x0B-\x1F\x7F]/g;

const ASCII_FALLBACK_BYTE = 0x3f; // "?" — last resort for anything else unencodable

/** Encodes a single non-ASCII, non-CP858 character by stripping it down to
 * its ASCII base letter (NFD-decompose, drop combining marks), e.g. "č" -> "c".
 * Falls back to "?" when nothing ASCII is left (emoji, CJK, symbols, …). */
function transliterateChar(ch: string): number[] {
  const decomposed = ch.normalize("NFD").replace(/[\u0300-\u036F]/g, "");
  const out: number[] = [];
  for (const c of decomposed) {
    const cp = c.codePointAt(0) ?? ASCII_FALLBACK_BYTE;
    if (cp >= 0x20 && cp <= 0x7e) {
      out.push(cp);
    } else {
      const mapped = CP858_ENCODE.get(cp);
      out.push(mapped ?? ASCII_FALLBACK_BYTE);
    }
  }
  return out.length > 0 ? out : [ASCII_FALLBACK_BYTE];
}

/**
 * Encodes a string to CP858 bytes for the ESC/POS thermal printer, which
 * renders raw bytes through whatever single-byte code page it has selected
 * — it does not decode UTF-8. This is the sole choke point every printed
 * field passes through (see `text()` in lib/printer.ts); nothing should
 * reach the printer as a raw UTF-8 multi-byte sequence it will render as
 * mojibake.
 *
 * Order of preference per character:
 * 1. Plain ASCII (0x20-0x7E, plus tab/newline) — passed through as-is.
 * 2. A CP858 code-page byte, if the code page can represent it (covers
 *    accented Spanish: á é í ó ú ü ñ Ñ ¿ ¡ and friends) — prints the
 *    *intended* glyph, matching the printer's `ESC t 19` code-page select.
 * 3. ASCII transliteration (strip diacritics), e.g. "José" -> "Jose".
 * 4. "?" for anything transliteration can't reduce to ASCII either.
 *
 * Does NOT touch the on-screen/digital receipt — this is print-path only;
 * callers must not use it to sanitize strings shown in the UI.
 */
export function encodeCp858(input: string): number[] {
  const normalized = input.replace(UNICODE_SPACE_RE, " ").replace(DROP_RE, "");
  const bytes: number[] = [];

  for (const ch of normalized) {
    const cp = ch.codePointAt(0) ?? ASCII_FALLBACK_BYTE;
    if ((cp >= 0x20 && cp <= 0x7e) || cp === 0x0a || cp === 0x09) {
      bytes.push(cp);
      continue;
    }
    const mapped = CP858_ENCODE.get(cp);
    if (mapped !== undefined) {
      bytes.push(mapped);
      continue;
    }
    bytes.push(...transliterateChar(ch));
  }

  return bytes;
}
