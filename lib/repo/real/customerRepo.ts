/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { createCreateCustomer } from "../../customers/createCustomer";
import { createListCustomers } from "../../customers/listCustomers";
import { createGetCustomer } from "../../customers/getCustomer";
import type { Database } from "../../db/client";
import type { CustomerRepo } from "../types";

export function createRealCustomerRepo({ db }: { db: Database }): CustomerRepo {
  const listCustomers = createListCustomers({ db });
  const getCustomer = createGetCustomer({ db });
  const createCustomer = createCreateCustomer({ db });

  return {
    list: () => listCustomers({}),
    get: (id) => getCustomer({ id }),
    create: (input) => createCustomer(input)
  };
}
