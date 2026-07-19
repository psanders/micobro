/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { useState } from "react";
import {
  WifiOff,
  Lock,
  FileSpreadsheet,
  Share2,
  Banknote,
  History,
  Quote,
  RefreshCw,
  BatteryCharging,
  SignalZero,
  Sun,
  MapPin,
  HandCoins,
  Receipt,
  CircleCheckBig
} from "lucide-react";
import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";
import { Banner } from "../components/Banner";
import { DownloadModal, WHATSAPP_GROUP_URL } from "../components/DownloadModal";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";
import { CreativeMark } from "../components/CreativeMark";
import hoyScreen from "../assets/hoy-screen.png";
import cobroScreen from "../assets/cobro-screen.png";
import reciboScreen from "../assets/recibo-screen.png";

const TRUST_ROW = [
  { icon: WifiOff, label: "Sin internet obligatorio" },
  { icon: Lock, label: "PIN local" },
  { icon: FileSpreadsheet, label: "Tu Google Sheet, tuyo" }
] as const;

const PAINS = [
  { num: "01", label: "Se pierde o se moja la libreta" },
  { num: "02", label: "No te acuerdas quién pagó" },
  { num: "03", label: "Cuentas a mano cada noche" },
  { num: "04", label: "Pierdes el teléfono, pierdes el Excel" }
] as const;

const FLOW_STEPS = [
  { num: "1", title: "Hoy", desc: "Empiezas viendo tu meta del día." },
  { num: "2", title: "Mi Ruta", desc: "Ves las visitas de hoy, en orden." },
  { num: "3", title: "Cobro", desc: "Registras el pago; la mora se aplica primero." },
  { num: "4", title: "Recibo", desc: "Envías o imprimes el recibo al momento." },
  { num: "5", title: "Cuadre", desc: "Cierras el día con la caja cuadrada." }
] as const;

const FEATURES = [
  {
    icon: WifiOff,
    title: "Sin conexión",
    desc: "Funciona sin señal ni wifi. Sincroniza cuando puedas."
  },
  {
    icon: Share2,
    title: "Recibos por WhatsApp o impresos",
    desc: "Reenvía o imprime cualquier recibo, cuando lo necesites."
  },
  {
    icon: Banknote,
    title: "Cuadre de caja automático",
    desc: "El total del día se calcula solo, sin hojas de cálculo."
  },
  {
    icon: History,
    title: "Historial por cliente y préstamo",
    desc: "Cada pago y cada visita, siempre a la mano."
  },
  {
    icon: Lock,
    title: "PIN local",
    desc: "Nadie más entra a tu app, ni siquiera con el teléfono en mano."
  },
  {
    icon: FileSpreadsheet,
    title: "Respaldo en tu Google Sheet",
    desc: "Tus datos respaldados en la nube — pero son tuyos, no nuestros."
  }
] as const;

const TRUST_POINTS = [
  {
    icon: SignalZero,
    title: "Cero dependencia de internet",
    desc: "Registra cobros, clientes y préstamos sin conexión."
  },
  {
    icon: RefreshCw,
    title: "Sincroniza cuando puedas",
    desc: "En cuanto haya señal, todo sube solo a tu Google Sheet."
  },
  {
    icon: BatteryCharging,
    title: "Ahorra datos y batería",
    desc: "Sin cargar mapas ni contenido pesado en segundo plano."
  }
] as const;

const TESTIMONIALS = [
  { name: "[Nombre]", city: "[Ciudad]" },
  { name: "[Nombre]", city: "[Ciudad]" },
  { name: "[Nombre]", city: "[Ciudad]" }
] as const;

const STEP_ICONS = [Sun, MapPin, HandCoins, Receipt, CircleCheckBig] as const;

export function HomePage() {
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);

  function handleDownloadClick() {
    window.open(WHATSAPP_GROUP_URL, "_blank", "noopener,noreferrer");
    setDownloadModalOpen(true);
  }

  return (
    <div className="min-h-screen bg-brand-white font-sans text-brand-ink">
      <Banner />
      <Nav onDownloadClick={handleDownloadClick} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-[linear-gradient(180deg,#FFFFFF_0%,#E2EDFC_100%)]">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand-blue-sky/15 blur-[100px] md:h-[420px] md:w-[420px]" />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-56 w-56 rounded-full bg-brand-orange-primary-2/12 blur-[90px] md:h-[380px] md:w-[380px]" />

        <div className="relative mx-auto flex max-w-[1440px] flex-col items-center gap-10 px-6 py-12 md:flex-row md:items-center md:justify-between md:gap-12 md:px-20 md:py-28">
          <div className="flex w-full flex-col items-center gap-6 text-center md:max-w-xl md:items-start md:gap-6 md:text-left">
            <span className="rounded-full bg-brand-mist px-3.5 py-1.5 text-xs font-bold text-brand-blue-deep md:text-[13px]">
              Hecho para prestamistas dominicanos
            </span>

            <h1 className="text-[32px] font-extrabold leading-[1.1] tracking-[-0.5px] text-brand-ink md:text-[54px] md:tracking-[-1px]">
              Lleva tus préstamos al día, aunque no haya señal.
            </h1>

            <p className="text-base leading-relaxed text-ds-muted md:text-[19px]">
              Micobro registra tus clientes, préstamos y cobros desde el celular — sin depender de
              internet ni de una libreta.
            </p>

            <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
              <PrimaryButton className="w-full md:w-auto" onClick={handleDownloadClick}>
                Descargar en Google Play
              </PrimaryButton>
              <SecondaryButton as="a" href="#como-funciona" className="w-full md:w-auto">
                Ver cómo funciona
              </SecondaryButton>
            </div>

            <div className="flex flex-col items-center gap-2.5 md:flex-row md:items-center md:gap-5">
              {TRUST_ROW.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 text-[13px] font-semibold text-ds-muted"
                >
                  <Icon className="h-[14px] w-[14px]" strokeWidth={2} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="flex w-full justify-center pt-2 md:w-auto md:pt-0">
            <CreativeMark className="w-[260px] md:w-[420px]" />
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="bg-brand-mist px-6 py-16 md:px-20 md:py-24">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-10 md:gap-14">
          <div className="flex max-w-[760px] flex-col items-center gap-4 text-center">
            <span className="text-[12px] font-bold tracking-widest text-brand-orange-deep md:text-[13px]">
              CÓMO LO HACES HOY
            </span>
            <h2 className="text-[28px] font-extrabold leading-[1.15] text-brand-ink md:text-[38px]">
              ¿Todavía llevas tus cuentas en una libreta... o en la cabeza?
            </h2>
          </div>

          <div className="flex w-full flex-col gap-6 md:flex-row md:justify-center md:gap-10">
            {PAINS.map((p) => (
              <div
                key={p.num}
                className="flex items-center gap-4 md:w-[260px] md:flex-col md:items-center md:gap-4 md:text-center"
              >
                <span className="text-lg font-extrabold text-brand-orange-primary md:text-xl">
                  {p.num}
                </span>
                <span className="text-[15px] font-semibold text-brand-ink">{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution / How it works */}
      <section id="como-funciona" className="bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-10 px-6 pb-0 pt-16 md:gap-16 md:px-20 md:pb-24 md:pt-24">
          <div className="flex max-w-[700px] flex-col items-center gap-4 text-center">
            <span className="text-[12px] font-bold tracking-widest text-brand-blue-primary md:text-[13px]">
              LA SOLUCIÓN
            </span>
            <h2 className="text-[28px] font-extrabold leading-[1.15] text-brand-ink md:text-[38px]">
              Micobro hace lo que ya haces — pero mejor.
            </h2>
            <p className="text-[15px] leading-relaxed text-ds-muted md:text-[17px]">
              Organiza lo que ya haces cada día: la ruta, el cobro, el recibo, el cuadre — sin
              cambiar tu forma de trabajar.
            </p>
          </div>

          <div className="flex w-full flex-col items-center gap-12 md:flex-row md:items-center md:justify-between md:gap-14">
            <div className="flex w-full flex-col gap-5 md:w-[420px]">
              {FLOW_STEPS.map((step, idx) => {
                const Icon = STEP_ICONS[idx];
                return (
                  <div key={step.num} className="flex items-start gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-mist text-[15px] font-extrabold text-brand-blue-deep">
                      {step.num}
                    </span>
                    <div className="flex flex-col gap-0.5 pt-1">
                      <span className="flex items-center gap-1.5 text-[16px] font-bold text-brand-ink">
                        {step.title}
                        <Icon className="h-4 w-4 text-brand-blue-deep/60" strokeWidth={2} />
                      </span>
                      <span className="text-sm leading-snug text-ds-muted">{step.desc}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop screen cascade */}
            <div className="relative hidden h-[576px] w-[420px] shrink-0 md:block">
              <img
                src={hoyScreen}
                alt="Pantalla Hoy de Micobro"
                className="absolute left-0 top-[44px] w-[244px] rounded-[28px] shadow-2xl"
              />
              <img
                src={reciboScreen}
                alt="Recibo de pago confirmado en Micobro"
                className="absolute right-0 top-[44px] w-[244px] rounded-[28px] shadow-2xl"
              />
              <img
                src={cobroScreen}
                alt="Pantalla de registrar cobro en Micobro"
                className="absolute left-1/2 top-0 w-[244px] -translate-x-1/2 rounded-[28px] shadow-2xl"
              />
            </div>
          </div>
        </div>

        {/* Mobile screen showcase */}
        <div className="relative mt-10 overflow-hidden bg-[linear-gradient(155deg,#142A26_0%,#04110D_100%)] py-12 md:hidden">
          <div className="pointer-events-none absolute -left-16 -top-10 h-56 w-56 rounded-full bg-brand-blue-sky/20 blur-[80px]" />
          <div className="pointer-events-none absolute -right-10 bottom-0 h-52 w-52 rounded-full bg-brand-orange-primary-2/15 blur-[75px]" />
          <img src={hoyScreen} alt="Pantalla Hoy de Micobro" className="relative mx-auto w-full" />
        </div>
      </section>

      {/* Features */}
      <section id="funcionalidades" className="bg-brand-mist px-6 py-16 md:px-20 md:py-24">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-12 md:gap-16">
          <div className="flex max-w-[700px] flex-col items-center gap-4 text-center">
            <span className="text-[12px] font-bold tracking-widest text-brand-blue-primary md:text-[13px]">
              FUNCIONALIDADES CLAVE
            </span>
            <h2 className="text-[28px] font-extrabold leading-[1.15] text-brand-ink md:text-[38px]">
              Todo lo que necesitas para llevar tu negocio al día
            </h2>
          </div>

          <div className="grid w-full grid-cols-1 gap-10 md:grid-cols-3 md:gap-12">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex flex-col gap-3">
                <div className="h-1 w-8 rounded-full bg-brand-blue-primary" />
                <f.icon className="h-6 w-6 text-brand-blue-deep" strokeWidth={2} />
                <h3 className="text-[17px] font-bold leading-snug text-brand-ink">{f.title}</h3>
                <p className="text-sm leading-relaxed text-ds-muted">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust / offline-first */}
      <section className="bg-[linear-gradient(155deg,#142A26_0%,#04110D_100%)] px-6 py-16 md:px-20 md:py-24">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-10 md:flex-row md:items-center md:justify-between md:gap-20">
          <div className="flex w-full flex-col gap-5 md:max-w-[520px]">
            <span className="text-[12px] font-bold tracking-widest text-brand-yellow-accent md:text-[13px]">
              POR QUÉ FUNCIONA SIN CONEXIÓN
            </span>
            <h2 className="text-[26px] font-extrabold leading-[1.15] text-white md:text-[36px]">
              Tu negocio no debería depender de tener señal.
            </h2>
            <p className="text-[15px] leading-relaxed text-brand-night-muted md:text-[16px]">
              En muchas zonas del país la señal va y viene. Micobro guarda todo en tu teléfono al
              instante — cuando haya internet, sincroniza solo. Cuando no, sigues cobrando igual.
            </p>
          </div>

          <div className="flex w-full flex-col gap-6 md:max-w-[440px]">
            {TRUST_POINTS.map((t) => (
              <div key={t.title} className="flex flex-col gap-1">
                <h3 className="text-[15px] font-bold text-white">{t.title}</h3>
                <p className="text-[13px] leading-relaxed text-brand-night-muted">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-brand-mist px-6 py-16 md:px-20 md:py-24">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-10 md:gap-14">
          <div className="flex max-w-[700px] flex-col items-center gap-4 text-center">
            <span className="text-[12px] font-bold tracking-widest text-brand-blue-primary md:text-[13px]">
              LO QUE DICEN LOS PRESTAMISTAS
            </span>
            <h2 className="text-[26px] font-extrabold leading-[1.15] text-brand-ink md:text-[34px]">
              Prestamistas como tú ya confían en Micobro
            </h2>
          </div>

          <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-3 md:gap-10">
            {TESTIMONIALS.map((t, idx) => (
              <div key={idx} className="flex flex-col gap-5 rounded-[20px] bg-white p-7">
                <Quote className="h-6 w-6 text-brand-blue-primary" strokeWidth={2} />
                <p className="text-[14px] leading-relaxed text-brand-ink md:text-[15px]">
                  [Cita de un prestamista sobre cómo Micobro le ayudó en su día a día]
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-brand-mist md:h-10 md:w-10" />
                  <div className="flex flex-col">
                    <span className="text-[13px] font-bold text-brand-ink">{t.name}</span>
                    <span className="text-xs text-ds-muted">{t.city}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-[linear-gradient(180deg,#34C9A6_0%,#0B4F4A_100%)] px-6 py-16 md:px-20 md:py-24">
        <div className="mx-auto flex max-w-[700px] flex-col items-center gap-6 text-center">
          <h2 className="text-[26px] font-extrabold leading-[1.15] text-white md:text-[36px]">
            Empieza a cobrar sin perder ni un peso de vista.
          </h2>
          <p className="text-[15px] text-brand-mist md:text-[17px]">
            Descárgala gratis y digitaliza tu cartera hoy mismo.
          </p>
          <PrimaryButton
            className="w-full !bg-white !text-brand-blue-deep hover:!bg-brand-mist md:w-auto"
            onClick={handleDownloadClick}
          >
            Descargar en Google Play
          </PrimaryButton>
        </div>
      </section>

      <Footer />

      <DownloadModal open={downloadModalOpen} onClose={() => setDownloadModalOpen(false)} />
    </div>
  );
}
