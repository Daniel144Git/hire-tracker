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

/** Short names of the reconciliation checks (brief 4.2). */
export const CHECK_LABEL: Record<string, string> = {
  R1: "Billed after off-hire",
  R2: "Billed before start of hire",
  R3: "Billed twice",
  R4: "Month on hire with no invoice",
  R5: "Amount differs from agreed rate",
  R6: "Rate changed since last month",
  R7: "Continuation after return",
  R8: "Fleet code not on an order",
  R9: "Charge with nothing recorded on site",
  R10: "VAT or totals",
  R12: "Different rates for the same item",
  R13: "Damage waiver",
  R14: "Broken invoice chain",
  R15: "Item gone or new: confirm on site",
  R16: "Suspension credit",
  R17: "Transport charged twice",
};

export const SEVERITY_LABEL: Record<string, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};
