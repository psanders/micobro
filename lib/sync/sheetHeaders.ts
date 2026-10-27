/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The header row of every synced tab. Provisioning writes it; pull checks it
 * before trusting a tab's rows (a renamed or moved column must never be read
 * as data, nor make every row look deleted).
 */

// Spanish header labels, keyed by entity. Column order and count MUST match the
// corresponding ENTITY_RANGES width and the push.ts row mappers — a test guards
// the width. Money is stored as integer cents (see the "(centavos)" columns).
export const TAB_HEADERS: Record<string, string[]> = {
  customer: ["ID", "Nombre", "Cédula", "Teléfono", "Dirección", "Creado", "Actualizado"],
  loan: [
    "ID",
    "Cliente ID",
    "Capital (centavos)",
    "Interés (bps)",
    "Cuotas",
    "Frecuencia",
    "Inicio",
    "Estado",
    "Notas",
    "Período de gracia (días)",
    "Mora activa",
    "Mora (bps)",
    "Salta domingos",
    "Tipo",
    "Creado",
    "Actualizado"
  ],
  payment: ["ID", "Préstamo ID", "Monto (centavos)", "Pagado", "Método", "Notas", "Creado"],
  visit: [
    "ID",
    "Cliente ID",
    "Préstamo ID",
    "Resultado",
    "Fecha promesa",
    "Monto promesa (centavos)",
    "Nota",
    "Creado"
  ],
  cashClose: ["ID", "Monto (centavos)", "Desde", "Cerrado", "Creado"]
};
