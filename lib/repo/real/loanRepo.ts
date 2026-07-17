/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { createCreateLoan } from "../../loans/createLoan";
import { createListLoans } from "../../loans/listLoans";
import { createListLoansByCustomer } from "../../loans/listLoansByCustomer";
import { createGetLoanDetail } from "../../loans/getLoanDetail";
import { createGetLoanDetailView } from "../../loans/getLoanDetailView";
import { createGetPaymentHistory } from "../../loans/getPaymentHistory";
import { notifyMutationQueued } from "../../sync/syncEvents";
import type { Database } from "../../db/client";
import type { LoanRepo } from "../types";

export function createRealLoanRepo({ db }: { db: Database }): LoanRepo {
  const listLoans = createListLoans({ db });
  const listLoansByCustomer = createListLoansByCustomer({ db });
  const getLoanDetail = createGetLoanDetail({ db });
  const createLoan = createCreateLoan({ db });
  const getLoanDetailView = createGetLoanDetailView({ db });
  const getPaymentHistory = createGetPaymentHistory({ db });

  return {
    list: () => listLoans({}),
    listByCustomer: (customerId) => listLoansByCustomer({ customerId }),
    get: (id) => getLoanDetail({ id }),
    create: async (input) => {
      const loan = await createLoan(input);
      notifyMutationQueued();
      return loan;
    },
    getDetailView: (id) => getLoanDetailView({ id }),
    getPaymentHistory: (id) => getPaymentHistory({ id })
  };
}
