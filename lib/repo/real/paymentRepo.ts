/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { createCreatePayment } from "../../payments/createPayment";
import { createListPaymentsByLoan } from "../../payments/listPaymentsByLoan";
import { createListPaymentsToday } from "../../payments/listPaymentsToday";
import { createGetCollectContext } from "../../payments/getCollectContext";
import { createCollectPayment } from "../../payments/collectPayment";
import type { Database } from "../../db/client";
import type { PaymentRepo } from "../types";

export function createRealPaymentRepo({ db }: { db: Database }): PaymentRepo {
  const listPaymentsByLoan = createListPaymentsByLoan({ db });
  const listPaymentsToday = createListPaymentsToday({ db });
  const createPayment = createCreatePayment({ db });
  const getCollectContext = createGetCollectContext({ db });
  const collectPayment = createCollectPayment({ db });

  return {
    listByLoan: (loanId) => listPaymentsByLoan({ loanId }),
    create: (input) => createPayment(input),
    getCollectContext: (loanId) => getCollectContext({ loanId }),
    collect: (input) => collectPayment(input),
    listToday: () => listPaymentsToday({})
  };
}
