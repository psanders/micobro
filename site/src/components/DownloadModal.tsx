/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { HeartHandshake, MessageCircle, X } from "lucide-react";

export const WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/Dh0lEeocwVj65T9xNyTCNC";

interface DownloadModalProps {
  open: boolean;
  onClose: () => void;
}

export function DownloadModal({ open, onClose }: DownloadModalProps) {
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
          <HeartHandshake className="h-[26px] w-[26px] text-brand-blue-deep" strokeWidth={2} />
        </div>

        <h2 className="text-[22px] font-extrabold leading-tight text-brand-ink">
          Por ahora, solo para familiares y amigos
        </h2>

        <p className="text-sm leading-relaxed text-ds-muted">
          Micobro todavía está en pruebas cerradas. Muy pronto abriremos la descarga para todos.
          Mientras tanto, si quieres ser parte de la prueba, escríbenos.
        </p>

        <a
          href={WHATSAPP_GROUP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2.5 rounded-full bg-brand-blue-deep px-6 py-4 text-[15px] font-bold text-white no-underline transition-colors hover:bg-[#0a4640]"
        >
          <MessageCircle className="h-[18px] w-[18px]" strokeWidth={2} />
          Unirme al grupo de WhatsApp
        </a>

        <button
          type="button"
          onClick={onClose}
          className="text-center text-[13px] font-bold text-ds-muted underline hover:text-brand-ink"
        >
          Entendido, seguir viendo
        </button>
      </div>
    </div>
  );
}
