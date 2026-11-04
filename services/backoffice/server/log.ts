/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * One JSON line per event on stdout/stderr. Never log credentials, tokens
 * or request bodies.
 */
type Fields = Record<string, unknown>;

function line(level: string, message: string, fields: Fields = {}) {
  return JSON.stringify({ time: new Date().toISOString(), level, message, ...fields });
}

const quiet = () => process.env.BACKOFFICE_LOG === "silent";

export const logger = {
  info(message: string, fields?: Fields) {
    if (!quiet()) process.stdout.write(`${line("info", message, fields)}\n`);
  },
  warn(message: string, fields?: Fields) {
    if (!quiet()) process.stderr.write(`${line("warn", message, fields)}\n`);
  },
  error(message: string, fields?: Fields) {
    if (!quiet()) process.stderr.write(`${line("error", message, fields)}\n`);
  }
};
