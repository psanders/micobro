/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { Logo } from "./Logo";
import { FacebookIcon, InstagramIcon } from "./SocialIcons";

const SOCIAL = [
  { icon: InstagramIcon, label: "Instagram", href: "https://www.instagram.com/micobro.do/" },
  { icon: FacebookIcon, label: "Facebook", href: "#" }
] as const;

const PRODUCT_LINKS = [
  { label: "Funcionalidades", href: "#funcionalidades" },
  { label: "Precios", href: `${import.meta.env.BASE_URL}precios` }
] as const;

const COMPANY_LINKS = [
  { label: "Nosotros", href: "#" },
  { label: "Contacto", href: "#" }
] as const;

const LEGAL_LINKS = [
  { label: "Privacidad", href: "#" },
  { label: "Términos", href: "#" }
] as const;

function LinkColumn({
  title,
  links
}: {
  title: string;
  links: ReadonlyArray<{ label: string; href: string }>;
}) {
  return (
    <div>
      <p className="text-[11px] font-bold tracking-widest text-brand-mist">{title}</p>
      <ul className="mt-3 flex flex-col gap-3">
        {links.map((item) => (
          <li key={item.label}>
            <a href={item.href} className="text-sm font-medium text-white/90 hover:text-white">
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="bg-brand-blue-primary text-white">
      <div className="mx-auto max-w-[1440px] px-6 pb-8 pt-12 md:px-20 md:pb-10 md:pt-16">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between md:gap-16">
          <div className="max-w-[320px]">
            <a href={import.meta.env.BASE_URL}>
              <Logo inverted />
            </a>
            <p className="mt-3.5 text-sm leading-relaxed text-brand-mist">
              Funciona sin conexión para prestamistas dominicanos.
            </p>
          </div>

          <div className="flex gap-14">
            <LinkColumn title="PRODUCTO" links={PRODUCT_LINKS} />
            <LinkColumn title="COMPAÑÍA" links={COMPANY_LINKS} />
            <LinkColumn title="LEGAL" links={LEGAL_LINKS} />
          </div>
        </div>

        <div className="mt-10 h-px w-full bg-brand-night-border/40" />

        <div className="mt-6 flex flex-col-reverse items-center gap-6 md:flex-row md:justify-between">
          <p className="text-[13px] text-brand-mist">
            © 2026 Micobro. Todos los derechos reservados.
          </p>
          <div className="flex gap-4">
            {SOCIAL.map(({ icon: Icon, label, href }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="text-white hover:text-brand-mist"
              >
                <Icon className="h-[18px] w-[18px]" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
