/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Copy for the legal pages, per website.pen "Privacidad — Micobro" and
 * "Eliminar datos — Micobro". Keep it in step with what the app actually
 * does: no backend, local SQLite, optional sync to the lender's own Sheet
 * under the drive.file scope, no analytics in the app.
 */
import type { LegalSection } from "../pages/LegalPage";
import { ContactEmail as Mail, LegalLink as A } from "./LegalLink";

export const UPDATED = "Última actualización: 21 de octubre de 2026";

export const privacyIntro =
  "Micobro es una app para prestamistas independientes en la República Dominicana. Esta política explica qué datos maneja la app, dónde se guardan y qué control tienes sobre ellos. En corto: tus datos viven en tu teléfono, Micobro no tiene servidores que los reciban y nunca los vendemos ni los compartimos.";

export const privacySections: LegalSection[] = [
  {
    heading: "1. Qué datos maneja la app",
    body: "Solo lo que tú escribes: tus clientes (nombre, teléfono, dirección y cédula si la anotas), tus préstamos, pagos, visitas y cuadres de caja, y tu perfil (nombre, negocio, teléfono y avatar). Tu PIN se guarda cifrado en el teléfono."
  },
  {
    heading: "2. Dónde se guardan",
    body: "En una base de datos dentro de tu teléfono. Micobro no tiene un servidor propio: nosotros no recibimos, no vemos y no guardamos tus clientes, préstamos ni pagos."
  },
  {
    heading: "3. Respaldo con Google (opcional)",
    body: "Si decides conectar tu cuenta de Google, la app crea una hoja de cálculo «Micobro / Datos» en tu propio Google Drive y la mantiene al día. Usamos el permiso más limitado (drive.file): la app solo puede ver los archivos que ella misma crea. Google nos da tu correo para identificar la cuenta conectada. Los datos viajan directo de tu teléfono a Google, cifrados (HTTPS). Puedes desconectarte cuando quieras."
  },
  {
    heading: "4. Permisos del teléfono",
    body: "Bluetooth: para imprimir recibos en una impresora térmica; no se usa para saber tu ubicación. Micrófono y grabación de pantalla: solo cuando tú inicias «Enviar feedback» y aceptas; la grabación se queda en tu teléfono. WhatsApp: la app solo abre WhatsApp con el mensaje listo; el envío lo haces tú."
  },
  {
    heading: "5. Con quién los compartimos",
    body: "Con nadie. No vendemos datos, no mostramos publicidad y la app no usa herramientas de analítica ni de rastreo."
  },
  {
    heading: "6. Nuestro sitio web",
    body: "micobro.app usa Meta Pixel para medir visitas y solicitudes de invitación. Si pides una invitación, guardamos tu nombre y tu número de WhatsApp para contactarte."
  },
  {
    heading: "7. Borrar tus datos",
    body: (
      <>
        Desde la app: Mi cuenta → Eliminar mis datos borra todo lo guardado en el teléfono y
        desconecta Google. La hoja «Micobro / Datos» es tuya y queda en tu Drive; puedes borrarla
        desde Google Drive. Más detalles en{" "}
        <A href={`${import.meta.env.BASE_URL}eliminar-datos/`}>micobro.app/eliminar-datos</A>.
      </>
    )
  },
  {
    heading: "8. Seguridad",
    body: "La app se protege con tu PIN y tus datos no salen del teléfono salvo hacia tu propia cuenta de Google, si la conectas."
  },
  {
    heading: "9. Menores de edad",
    body: "Micobro es para personas adultas que llevan su negocio de préstamos. No está dirigida a menores de 18 años."
  },
  {
    heading: "10. Cambios y contacto",
    body: (
      <>
        Si cambiamos esta política, actualizaremos la fecha de arriba. Para cualquier pregunta
        escríbenos a <Mail />.
      </>
    )
  }
];

export const deletionIntro =
  "Micobro no tiene cuentas ni servidores: tus datos están en tu teléfono y, si conectaste Google, en una hoja de tu propio Google Drive. Así borras cada parte.";

export const deletionSections: LegalSection[] = [
  {
    heading: "1. En la app",
    body: "Abre Mi cuenta → Eliminar mis datos, confirma y escribe tu PIN. La app borra tus clientes, préstamos, pagos, visitas, cuadres, tu perfil y tu PIN, y desconecta tu cuenta de Google. Esto no se puede deshacer."
  },
  {
    heading: "2. Tu respaldo en Google Drive",
    body: (
      <>
        La hoja «Micobro / Datos» es tuya y la app no la borra. Para eliminarla, abre{" "}
        <A href="https://drive.google.com">drive.google.com</A>, busca la carpeta «Micobro», muévela
        a la papelera y vacía la papelera.
      </>
    )
  },
  {
    heading: "3. Quitar el acceso de Micobro a Google",
    body: (
      <>
        En <A href="https://myaccount.google.com/connections">myaccount.google.com</A> → Seguridad →
        Conexiones con terceros, elige Micobro y quita el acceso.
      </>
    )
  },
  {
    heading: "4. Si ya no tienes la app",
    body: "Desinstalarla borra todo lo guardado en el teléfono. Tu hoja en Drive sigue siendo tuya: bórrala como en el punto 2."
  },
  {
    heading: "5. ¿Necesitas ayuda?",
    body: (
      <>
        Escríbenos a <Mail />. Como no guardamos tus datos, no hay nada más que borrar de nuestro
        lado.
      </>
    )
  }
];
