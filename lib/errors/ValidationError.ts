/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import type { z } from "zod/v4";

export interface FieldError {
  field: string;
  message: string;
  code: string;
}

export class ValidationError extends Error {
  public readonly code = "VALIDATION_ERROR";
  public readonly fieldErrors: FieldError[];
  public readonly zodError: z.ZodError;

  constructor(zodError: z.ZodError) {
    const fieldErrors = ValidationError.extractFieldErrors(zodError);
    const message = ValidationError.formatMessage(fieldErrors);

    super(message);
    this.name = "ValidationError";
    this.zodError = zodError;
    this.fieldErrors = fieldErrors;

    const captureStackTrace = (
      Error as {
        captureStackTrace?: (target: object, ctor: new (...args: never[]) => unknown) => void;
      }
    ).captureStackTrace;
    captureStackTrace?.(this, ValidationError);
  }

  private static extractFieldErrors(zodError: z.ZodError): FieldError[] {
    return zodError.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
      code: issue.code
    }));
  }

  private static formatMessage(fieldErrors: FieldError[]): string {
    if (fieldErrors.length === 0) return "Validation failed";
    return fieldErrors.map((e) => (e.field ? `${e.field}: ${e.message}` : e.message)).join("; ");
  }
}
