/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { createCreateCustomer } from "../../customers/createCustomer";
import { createUpdateCustomer } from "../../customers/updateCustomer";
import { createListCustomers } from "../../customers/listCustomers";
import { createGetCustomer } from "../../customers/getCustomer";
import { createSearchCustomers } from "../../customers/searchCustomers";
import { createGetCustomerDetail } from "../../customers/getCustomerDetail";
import { createGetCustomerPhoto } from "../../customers/getCustomerPhoto";
import { notifyMutationQueued } from "../../sync/syncEvents";
import { createExpoSqlExecutor } from "../../db/sqlExecutor";
import type { Database } from "../../db/client";
import type { SqlExecutor } from "../../db/sqlExecutor";
import type { CustomerRepo } from "../types";

export function createRealCustomerRepo({
  db,
  sql = createExpoSqlExecutor(db)
}: {
  db: Database;
  sql?: SqlExecutor;
}): CustomerRepo {
  const listCustomers = createListCustomers({ db });
  const getCustomer = createGetCustomer({ db });
  const createCustomer = createCreateCustomer({ db, sql });
  const updateCustomer = createUpdateCustomer({ db, sql });
  const getCustomerPhoto = createGetCustomerPhoto({ db });
  const searchCustomers = createSearchCustomers({ db });
  const getCustomerDetail = createGetCustomerDetail({ db });

  return {
    list: () => listCustomers({}),
    get: (id) => getCustomer({ id }),
    create: async (input) => {
      const customer = await createCustomer(input);
      notifyMutationQueued();
      return customer;
    },
    update: (id, input) => updateCustomer({ id, ...input }),
    getPhoto: (id) => getCustomerPhoto({ customerId: id }),
    search: (query) => searchCustomers({ query }),
    getDetail: (id) => getCustomerDetail({ id })
  };
}
