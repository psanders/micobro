/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Minimal console-based logger. @fonoster/logger depends on winston/fluent-logger,
 * both Node-only (fs/stream) and unusable under Hermes on-device — this replaces it
 * for the mobile runtime while keeping the same verbose-entry/exit call shape.
 */
type LogFields = Record<string, unknown>;

function format(level: string, message: string, fields?: LogFields): string {
  return fields ? `[${level}] ${message} ${JSON.stringify(fields)}` : `[${level}] ${message}`;
}

export const logger = {
  verbose(message: string, fields?: LogFields): void {
    if (__DEV__) console.log(format("verbose", message, fields));
  },
  info(message: string, fields?: LogFields): void {
    console.log(format("info", message, fields));
  },
  warn(message: string, fields?: LogFields): void {
    console.warn(format("warn", message, fields));
  },
  error(message: string, fields?: LogFields): void {
    console.error(format("error", message, fields));
  }
};
