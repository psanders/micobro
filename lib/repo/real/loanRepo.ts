/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { createCreateLoan } from "../../loans/createLoan";
import { createListLoans } from "../../loans/listLoans";
import { createListLoansByCustomer } from "../../loans/listLoansByCustomer";
import { createGetLoanDetail } from "../../loans/getLoanDetail";
import type { Database } from "../../db/client";
import type { LoanRepo } from "../types";

export function createRealLoanRepo({ db }: { db: Database }): LoanRepo {
  const listLoans = createListLoans({ db });
  const listLoansByCustomer = createListLoansByCustomer({ db });
  const getLoanDetail = createGetLoanDetail({ db });
  const createLoan = createCreateLoan({ db });

  return {
    list: () => listLoans({}),
    listByCustomer: (customerId) => listLoansByCustomer({ customerId }),
    get: (id) => getLoanDetail({ id }),
    create: (input) => createLoan(input)
  };
}
