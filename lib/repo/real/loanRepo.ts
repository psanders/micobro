/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { createCreateLoan } from "../../loans/createLoan";
import { createListLoans } from "../../loans/listLoans";
import { createListLoansByCustomer } from "../../loans/listLoansByCustomer";
import { createGetLoanDetail } from "../../loans/getLoanDetail";
import { createGetLoanDetailView } from "../../loans/getLoanDetailView";
import { createGetPaymentHistory } from "../../loans/getPaymentHistory";
import { createUpdateLoan } from "../../loans/updateLoan";
import { createArchiveLoan } from "../../loans/archiveLoan";
import { createRestoreLoan } from "../../loans/restoreLoan";
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
  const updateLoan = createUpdateLoan({ db });
  const archiveLoan = createArchiveLoan({ db });
  const restoreLoan = createRestoreLoan({ db });

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
    getPaymentHistory: (id) => getPaymentHistory({ id }),
    // Each write wakes the sync engine like create does; a lender without a
    // Sheet just keeps the mutation queued until they connect.
    update: async (id, terms) => {
      const loan = await updateLoan({ id, ...terms });
      notifyMutationQueued();
      return loan;
    },
    archive: async (id) => {
      const loan = await archiveLoan({ id });
      notifyMutationQueued();
      return loan;
    },
    restore: async (id) => {
      const loan = await restoreLoan({ id });
      notifyMutationQueued();
      return loan;
    }
  };
}
