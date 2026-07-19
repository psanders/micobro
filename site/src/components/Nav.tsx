/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { PrimaryButton } from "./PrimaryButton";

const NAV_LINKS = [
  { label: "Cómo funciona", href: "#como-funciona" },
  { label: "Funcionalidades", href: "#funcionalidades" },
  { label: "Precios", href: `${import.meta.env.BASE_URL}precios` }
] as const;

interface NavProps {
  onDownloadClick: () => void;
}

export function Nav({ onDownloadClick }: NavProps) {
  const [open, setOpen] = useState(false);

  function close() {
    setOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 bg-white">
      <nav className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 md:h-20 md:px-20">
        <a href={import.meta.env.BASE_URL} onClick={close}>
          <Logo />
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-[15px] font-semibold text-brand-ink transition-colors hover:text-brand-blue-deep"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden md:block">
          <PrimaryButton size="nav" onClick={onDownloadClick}>
            Descargar app
          </PrimaryButton>
        </div>

        <button
          type="button"
          className="p-2 text-brand-ink md:hidden"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
        >
          {open ? (
            <X className="h-6 w-6" strokeWidth={2} />
          ) : (
            <Menu className="h-6 w-6" strokeWidth={2} />
          )}
        </button>
      </nav>

      {open && (
        <div className="border-t border-ds-border bg-white px-5 pb-5 md:hidden">
          <div className="flex flex-col gap-1 pt-2">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={close}
                className="rounded-lg px-3 py-2.5 text-[15px] font-semibold text-brand-ink hover:bg-brand-mist"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
