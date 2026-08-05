/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { Tag, X } from "lucide-react";

interface PricingModalProps {
  open: boolean;
  onClose: () => void;
}

export function PricingModal({ open, onClose }: PricingModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-ink/50 p-6"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-[420px] flex-col gap-5 rounded-[20px] bg-white p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-mist text-brand-blue-deep transition-colors hover:bg-brand-mist/70"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-mist">
          <Tag className="h-[26px] w-[26px] text-brand-blue-deep" strokeWidth={2} />
        </div>

        <h2 className="text-[22px] font-extrabold leading-tight text-brand-ink">
          Micobro es gratis, por ahora
        </h2>

        <p className="text-sm leading-relaxed text-ds-muted">
          Hoy puedes usar Micobro sin pagar un peso. Más adelante sumaremos funciones nuevas y
          algunas serán de pago, pero eso no cambiará mientras sigamos en esta etapa temprana.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="flex items-center justify-center rounded-full bg-brand-blue-deep px-6 py-4 text-[15px] font-bold text-white transition-colors hover:bg-[#0a4640]"
        >
          Entendido, seguir viendo
        </button>
      </div>
    </div>
  );
}
