/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { useEffect, useState } from "react";
import { CircleAlert, CircleCheck, HeartHandshake, Send, User, Phone, X } from "lucide-react";
import { trackCustom, trackLead } from "../lib/metaPixel";
import { normalizeWhatsapp, submitInviteRequest } from "../lib/inviteRequest";

interface DownloadModalProps {
  open: boolean;
  onClose: () => void;
}

type Status = "idle" | "submitting" | "success" | "error";

const NOMBRE_ERROR = "Escribe tu nombre.";
// One error per field: a blank name used to raise a WhatsApp-flavoured message
// whose only example was an 809 number, which read as "829 is not accepted".
const WHATSAPP_ERROR = "Escribe tu WhatsApp, por ejemplo 829 111 1111.";
const SUBMIT_ERROR = "No pudimos enviar tu solicitud. Intenta de nuevo.";

export function DownloadModal({ open, onClose }: DownloadModalProps) {
  const [nombre, setNombre] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState(SUBMIT_ERROR);
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setNombre("");
      setWhatsapp("");
      setStatus("idle");
    }
  }

  useEffect(() => {
    if (open) {
      trackCustom("InviteFormOpen");
    }
  }, [open]);

  if (!open) {
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!nombre.trim()) {
      setErrorMessage(NOMBRE_ERROR);
      setStatus("error");
      return;
    }

    const normalized = normalizeWhatsapp(whatsapp);
    if (!normalized) {
      setErrorMessage(WHATSAPP_ERROR);
      setStatus("error");
      return;
    }

    setStatus("submitting");
    try {
      await submitInviteRequest({ nombre, whatsapp: normalized });
      setStatus("success");
      trackLead();
    } catch {
      setErrorMessage(SUBMIT_ERROR);
      setStatus("error");
    }
  }

  const isSuccess = status === "success";
  const isSubmitting = status === "submitting";

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

        <div
          className={`flex h-14 w-14 items-center justify-center rounded-full ${
            isSuccess ? "bg-ds-green-bg" : "bg-brand-mist"
          }`}
        >
          {isSuccess ? (
            <CircleCheck className="h-[26px] w-[26px] text-ds-green" strokeWidth={2} />
          ) : (
            <HeartHandshake className="h-[26px] w-[26px] text-brand-blue-deep" strokeWidth={2} />
          )}
        </div>

        <h2 className="text-[22px] font-extrabold leading-tight text-brand-ink">
          {isSuccess ? "¡Listo!" : "Solo por invitación, por ahora"}
        </h2>

        <p className="text-sm leading-relaxed text-ds-muted">
          {isSuccess
            ? "Te escribiremos por WhatsApp con tu invitación."
            : "Déjanos tu nombre y tu WhatsApp y te enviamos tu invitación."}
        </p>

        {!isSuccess && (
          <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="invite-nombre" className="text-[13px] font-semibold text-brand-ink">
                Nombre
              </label>
              <div className="flex items-center gap-2.5 rounded-xl bg-brand-mist px-4 py-3.5">
                <User className="h-[18px] w-[18px] shrink-0 text-brand-blue-primary" strokeWidth={2} />
                <input
                  id="invite-nombre"
                  type="text"
                  autoComplete="name"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Tu nombre"
                  disabled={isSubmitting}
                  className="w-full bg-transparent text-[15px] font-medium text-brand-ink outline-none placeholder:text-[#7888A8]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="invite-whatsapp" className="text-[13px] font-semibold text-brand-ink">
                WhatsApp
              </label>
              <div className="flex items-center gap-2.5 rounded-xl bg-brand-mist px-4 py-3.5">
                <Phone className="h-[18px] w-[18px] shrink-0 text-brand-blue-primary" strokeWidth={2} />
                <input
                  id="invite-whatsapp"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="829 111 1111"
                  disabled={isSubmitting}
                  className="w-full bg-transparent text-[15px] font-medium text-brand-ink outline-none placeholder:text-[#7888A8]"
                />
              </div>
            </div>

            {status === "error" && (
              <div className="flex items-center gap-2 rounded-xl bg-ds-red-bg px-3.5 py-3">
                <CircleAlert className="h-4 w-4 shrink-0 text-ds-red" strokeWidth={2} />
                <p className="text-[13px] font-semibold leading-snug text-ds-red">{errorMessage}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2.5 rounded-full bg-brand-blue-deep px-6 py-4 text-[15px] font-bold text-white transition-colors hover:bg-[#0a4640] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Send className="h-[18px] w-[18px]" strokeWidth={2} />
              {isSubmitting ? "Enviando..." : status === "error" ? "Intentar de nuevo" : "Pedir mi invitación"}
            </button>
          </form>
        )}

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
