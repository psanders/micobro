/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { PrimaryButton } from "./PrimaryButton";

type NavLink = { label: string; href: string } | { label: string; onClick: () => void };

const STATIC_NAV_LINKS: readonly NavLink[] = [
  { label: "Cómo funciona", href: "#como-funciona" },
  { label: "Funcionalidades", href: "#funcionalidades" }
];

/** The Mintlify docs site, deployed from `docs-site/` on main. */
export const DOCS_URL = "https://docs.micobro.app";

const NAV_LINK_CLASSNAME =
  "text-left text-[15px] font-semibold text-brand-ink transition-colors hover:text-brand-blue-deep";
const MOBILE_NAV_LINK_CLASSNAME =
  "rounded-lg px-3 py-2.5 text-left text-[15px] font-semibold text-brand-ink hover:bg-brand-mist";

interface NavProps {
  onDownloadClick: () => void;
  onPricingClick: () => void;
}

function NavLinkItem({
  link,
  className,
  onNavigate
}: {
  link: NavLink;
  className: string;
  onNavigate?: () => void;
}) {
  if ("onClick" in link) {
    return (
      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          link.onClick();
        }}
        className={className}
      >
        {link.label}
      </button>
    );
  }

  return (
    <a href={link.href} onClick={onNavigate} className={className}>
      {link.label}
    </a>
  );
}

export function Nav({ onDownloadClick, onPricingClick }: NavProps) {
  const [open, setOpen] = useState(false);

  const NAV_LINKS: readonly NavLink[] = [
    ...STATIC_NAV_LINKS,
    { label: "Precios", onClick: onPricingClick },
    { label: "Documentación", href: DOCS_URL }
  ];

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
            <NavLinkItem key={link.label} link={link} className={NAV_LINK_CLASSNAME} />
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
              <NavLinkItem
                key={link.label}
                link={link}
                className={MOBILE_NAV_LINK_CLASSNAME}
                onNavigate={close}
              />
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
