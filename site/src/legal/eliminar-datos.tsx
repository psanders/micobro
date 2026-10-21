/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import { LegalPage } from "../pages/LegalPage";
import { initMetaPixel } from "../lib/metaPixel";
import { UPDATED, deletionIntro, deletionSections } from "./content";

initMetaPixel();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LegalPage
      title="Eliminar tus datos"
      updated={UPDATED}
      intro={deletionIntro}
      sections={deletionSections}
    />
  </StrictMode>
);
