/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { useState } from "react";
import { Users, X } from "lucide-react";

export function Banner() {
  const [open, setOpen] = useState(true);

  if (!open) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-brand-blue-deep px-5 py-2.5 text-white md:px-20">
      <div className="flex items-center gap-2 md:gap-1.5">
        <Users className="h-4 w-4 shrink-0" strokeWidth={2} />
        <p className="text-[12px] leading-snug md:text-[13px]">
          <span className="font-bold">Acceso temprano:</span>{" "}
          <span className="text-brand-mist">
            por ahora, Micobro es solo para familiares y amigos.
          </span>
        </p>
      </div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Cerrar aviso"
        className="shrink-0 text-brand-mist hover:text-white"
      >
        <X className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}
