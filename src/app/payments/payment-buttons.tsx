import { setPaymentStatusAction } from "./actions";

const buttonClass = "rounded border border-line-strong px-2 py-0.5 text-sm font-medium";

/** The status changes that make sense from the current one. */
export function PaymentButtons({
  invoiceId,
  invoiceNumber,
  status,
}: {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
}) {
  const actions: [string, string][] =
    status === "UNPAID"
      ? [
          ["PAID", "Mark paid"],
          ["QUERIED", "Query"],
        ]
      : status === "QUERIED"
        ? [
            ["UNPAID", "Back to unpaid"],
            ["CREDITED", "Mark credited"],
          ]
        : [["UNPAID", "Back to unpaid"]];

  return (
    <div className="flex gap-2">
      {actions.map(([paymentStatus, label]) => (
        <form key={paymentStatus} action={setPaymentStatusAction}>
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <input type="hidden" name="paymentStatus" value={paymentStatus} />
          <button type="submit" className={buttonClass} aria-label={`${label}: ${invoiceNumber}`}>
            {label}
          </button>
        </form>
      ))}
    </div>
  );
}
