/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Shared layout for the legal pages (Privacidad, Eliminar datos) per
 * website.pen "Privacidad — Micobro": the site Nav and Footer around a
 * single readable column. Keeps the same modals the home page opens from
 * the Nav/Footer so those links behave identically here.
 */
import { useState, type ReactNode } from "react";
import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";
import { DownloadModal } from "../components/DownloadModal";
import { PricingModal } from "../components/PricingModal";

export interface LegalSection {
  heading: string;
  body: ReactNode;
}

interface LegalPageProps {
  title: string;
  updated: string;
  intro: ReactNode;
  sections: LegalSection[];
}

export function LegalPage({ title, updated, intro, sections }: LegalPageProps) {
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [pricingModalOpen, setPricingModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F4F7FB] font-sans text-brand-ink">
      <Nav
        onDownloadClick={() => setDownloadModalOpen(true)}
        onPricingClick={() => setPricingModalOpen(true)}
      />

      <main className="px-5 pb-24 pt-14 md:px-20 md:pb-28 md:pt-22">
        <article className="mx-auto flex max-w-[760px] flex-col gap-9">
          <header className="flex flex-col gap-3">
            <p className="text-[13px] font-bold tracking-[0.12em] text-brand-orange-deep">LEGAL</p>
            <h1 className="text-[34px] font-extrabold leading-tight md:text-[44px]">{title}</h1>
            <p className="text-[15px] font-medium text-ds-muted">{updated}</p>
          </header>

          <p className="text-[17px] font-medium leading-relaxed md:text-lg">{intro}</p>

          {sections.map((section) => (
            <section key={section.heading} className="flex flex-col gap-2.5">
              <h2 className="text-xl font-extrabold md:text-[22px]">{section.heading}</h2>
              <p className="text-base font-medium leading-[1.65]">{section.body}</p>
            </section>
          ))}
        </article>
      </main>

      <Footer onPricingClick={() => setPricingModalOpen(true)} />

      <DownloadModal open={downloadModalOpen} onClose={() => setDownloadModalOpen(false)} />
      <PricingModal open={pricingModalOpen} onClose={() => setPricingModalOpen(false)} />
    </div>
  );
}
