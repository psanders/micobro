/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { createCreatePayment } from "../../payments/createPayment";
import { createListPaymentsByLoan } from "../../payments/listPaymentsByLoan";
import type { Database } from "../../db/client";
import type { PaymentRepo } from "../types";

export function createRealPaymentRepo({ db }: { db: Database }): PaymentRepo {
  const listPaymentsByLoan = createListPaymentsByLoan({ db });
  const createPayment = createCreatePayment({ db });

  return {
    listByLoan: (loanId) => listPaymentsByLoan({ loanId }),
    create: (input) => createPayment(input)
  };
}
