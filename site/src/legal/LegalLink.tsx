/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import type { ReactNode } from "react";

export const CONTACT_EMAIL = "equipo@mikro.do";

const linkClass = "font-semibold text-brand-blue-primary underline underline-offset-2";

export function LegalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className={linkClass}>
      {children}
    </a>
  );
}

export function ContactEmail() {
  return <LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink>;
}
