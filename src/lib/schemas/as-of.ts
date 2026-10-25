import { z } from "zod";
import { isoDateSchema } from "./common";

/** "?asOf=YYYY-MM-DD": the date a register or a due list is calculated for. Defaults to today. */
export const asOfQuerySchema = z.strictObject({
  asOf: isoDateSchema.optional(),
});

/** Today as YYYY-MM-DD, in UTC like every other date in the app. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
