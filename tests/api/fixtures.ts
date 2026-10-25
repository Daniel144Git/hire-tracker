import { test as base } from "@playwright/test";
import { ApiClient } from "../support/api-client";

/** `api` sets up test data through the API; `request` is still there to call the endpoint under test. */
export const test = base.extend<{ api: ApiClient }>({
  api: async ({ request }, use) => {
    await use(new ApiClient(request));
  },
});

export { expect } from "@playwright/test";
