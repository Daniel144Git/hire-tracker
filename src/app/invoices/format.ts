/** £1,234.50, and -£39.60 for credits. */
export function formatPounds(amount: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);
}

export const INVOICE_TYPE_LABEL: Record<string, string> = {
  CONTINUATION: "Continuation",
  RETURN: "Return",
  SALE: "Sale",
};

export const CHARGE_TYPE_LABEL: Record<string, string> = {
  HIRE: "Hire",
  DAMAGE_WAIVER: "Damage waiver",
  TRANSPORT: "Transport",
  SALE: "Sale",
  OTHER: "Other",
};

export const LINK_PROBLEM_LABEL: Record<string, string> = {
  UNKNOWN_JOB_NO: "Not linked: job number not on any order",
  UNKNOWN_FLEET_CODE: "Fleet code not on any order",
  AMBIGUOUS_FLEET_CODE: "Not linked: fleet code on more than one order",
};
