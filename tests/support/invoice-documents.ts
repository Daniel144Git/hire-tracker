import { PDFDocument, StandardFonts } from "pdf-lib";
import type { TextFragment } from "@/lib/extraction/pdf-lines";

/*
 * Fictional supplier documents for the PDF reading tests.
 *
 * Each document is written as plain text laid out like the printed page: two or more spaces
 * separate the cells of a row, and a cell's column is where its first character is. The two
 * layouts copy where the labels and columns of a real supplier's invoice are, never its data:
 * every company, number, address and amount below is made up.
 */

// Small type, as on the suppliers' documents: a space between words (2.7pt) stays inside a
// cell and two spaces (5.4pt) start a new column, like the 4-5pt column gaps they print.
const LEFT_MARGIN = 20;
const FONT_SIZE = 4.5;
const CHAR_WIDTH = FONT_SIZE * 0.6; // Courier: every character is 0.6em wide.
const TOP = 800;
const ROW_HEIGHT = 10;

interface Cell {
  row: number;
  column: number;
  text: string;
}

function cellsOf(document: string): Cell[] {
  return document.split("\n").flatMap((line, row) =>
    [...line.matchAll(/\S+(?: \S+)*/g)].map((match) => ({
      row,
      column: match.index,
      text: match[0],
    })),
  );
}

/** The text fragments a PDF reader would return for the document, one per cell. */
export function fragmentsOf(document: string, page = 1): TextFragment[] {
  return cellsOf(document).map(({ row, column, text }) => ({
    page,
    x: LEFT_MARGIN + column * CHAR_WIDTH,
    y: TOP - row * ROW_HEIGHT,
    width: text.length * CHAR_WIDTH,
    text,
  }));
}

/** A real PDF of the document, one page per text, to test reading files end to end. */
export async function pdfOf(...pages: string[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Courier);
  for (const document of pages) {
    const page = pdf.addPage([595, 842]);
    for (const { row, column, text } of cellsOf(document)) {
      page.drawText(text, {
        x: LEFT_MARGIN + column * CHAR_WIDTH,
        y: TOP - row * ROW_HEIGHT,
        size: FONT_SIZE,
        font,
      });
    }
  }
  return pdf.save();
}

export interface DespatchInvoiceOptions {
  number?: string;
  jobNo?: string;
  accountNo?: string;
  customerRef?: string;
  fleetCode?: string;
}

/**
 * Layout 1, "despatch": header fields as "Label : value", lines grouped under despatch notes,
 * the fleet code on its own row under the item ("Ecode: ..."), and a VAT summary by VAT code.
 * August 2026 at £120.00/week is 4 wks 1 day = £504.00, plus a 10% damage waiver.
 */
export function despatchInvoice(options: DespatchInvoiceOptions = {}): string {
  const {
    number = "30451207",
    jobNo = "170200345",
    accountNo = "APX-000123",
    customerRef = "Riverside",
    fleetCode = "APX-SL-0042",
  } = options;
  return `
                                                             Invoice
                                                             Invoice No       : ${number}
  Brookfield Build Ltd                                       Invoice Date     : 31/08/2026
  1 Example Street                                           Due Date         : 30/09/2026
  Testtown                                                   Your Ref         : ${customerRef}
  TT1 1AA                                                    Our Ref          : ${jobNo}
                                                             Type             : Continuation
                                                             Last Invoice     : 30390001
                                                             Page             : 1 of 1
                                                             Account          : ${accountNo}
 Invoice queries must be notified within 10 days of the document date.
                                       Hire Period                Weeks
 Qty/Item                              From        To             /Days          Rate    Period       Total   VAT
   Despatch:  160001234 20/01/2026        Contact:  Sam
   Delivery Address:   Brookfield Build Ltd
                       Riverside Tower
                       1 River Road
                       London  SE1 9ZZ
 1 x Scissor lift 8m electric          01/08/26    31/08/26       4 wks 1 day   120.00   / week**    504.00   S
         Ecode: ${fleetCode}
 1 x Damage Waiver                     31/08/26                                  50.40   / each       50.40   S
         Charged at 10.00% of £504.00
   VAT      Description        Goods      Rate      VAT
   S        Standard           554.40     20.00     110.88             GOODS      554.40   £
                                                                       VAT        110.88   £
                                                                       TOTAL      665.28   £
  **Hire Continues
`;
}

/**
 * Layout 1 as a return invoice: two despatch notes, a fleet code with a letter suffix, one-day
 * lines, a collection charge and a damage waiver on the hire lines only.
 */
export function despatchReturnInvoice(): string {
  return `
                                                             Invoice
                                                             Invoice No       : 30451300
  Brookfield Build Ltd                                       Invoice Date     : 02/09/2026
  1 Example Street                                           Due Date         : 31/10/2026
  Testtown                                                   Your Ref         : NORTHGATE WORKS
  TT1 1AA                                                    Our Ref          : 170200400
                                                             Type             :Return
                                                             Last Invoice     : 30390010
                                                             Account          : APX-000123
 Qty/Item                              From        To             /Days          Rate    Period       Total   VAT
   Despatch:  160001300 03/03/2026
   Delivery Address:   Brookfield Build Ltd
                       Northgate Works,
                       Leeds  LS1 4AB
     Workshop Text:    03/03
 1 x Material lift 5m                  01/09/26    02/09/26       1 day          60.00   / week        12.00   S
         Ecode: M1001-2002R
 1 x Transport Collection              02/09/26                                  25.00   / each        25.00   S
   Despatch:  160001301 04/03/2026
 2 x Pipe stand roller head            01/09/26    02/09/26       2 days         10.00   / week         8.00   S
         Ecode: M1001-3003
 1 x Damage Waiver                     02/09/26                                   2.00   / each         2.00   S
         Charged at 10.00% of £20.00
   VAT      Description        Goods      Rate      VAT
   S        Standard           47.00      20.00     9.40               GOODS       47.00   £
                                                                       VAT          9.40   £
                                                                       TOTAL       56.40   £
`;
}

/** Layout 1 as a credit note: "Credit No", the period printed backwards, amounts as credits. */
export function despatchCreditNote(): string {
  return `
                                                             Credit
                                                             Credit No        : 30460001
  Brookfield Build Ltd                                       Credit Date      : 30/09/2026
  1 Example Street                                           Your Ref         : Riverside
  Testtown                                                   Our Ref          : 170200345
                                                             Type             : Return
                                                             Last Invoice     : 30451207
                                                             Account          : APX-000123
 Qty/Item                              From        To             /Days          Rate    Period       Total   VAT
   Despatch:  160001234 20/01/2026
 1 x Scissor lift 8m electric          31/08/26    28/08/26       1 day         120.00   / week        24.00   S
         Ecode: APX-SL-0042
 1 x Damage Waiver                     30/09/26                                  2.40-   / each         2.40   S
         Credit at 10.00% of £24.00
   VAT      Description        Goods      Rate      VAT
   S        Standard           26.40      20.00     5.28               GOODS       26.40   £
                                                                       VAT          5.28   £
                                                                       TOTAL       31.68   £
`;
}

/** Layout 1 as a damage charge: no hire period, and outside the scope of VAT (code O). */
export function despatchDamageCharge(): string {
  return `
                                                             Invoice
                                                             Invoice No       : 30470002
  Brookfield Build Ltd                                       Invoice Date     : 27/05/2026
  1 Example Street                                           Due Date         : 30/06/2026
  Testtown                                                   Your Ref         : Riverside
  TT1 1AA                                                    Our Ref          : 170200999
                                                             Type             :Workshop
                                                             Account          : APX-000123
 Qty/Item                                                     Date                  Price   Unit          Total   VAT
   Delivery Address:   Brookfield Build Ltd
                       Riverside Tower
        Invoice Text:   Adaptor returned with damaged tips
 Damage Charges
 1 x Parts - asset damaged beyond repair                     27/05/26              84.50                  84.50   O
           1 @ 84.5000
   VAT      Description        Goods      Rate      VAT
   O        Out of scope       84.50      0.00      0.00               GOODS       84.50   £
                                                                       VAT          0.00   £
                                                                       TOTAL       84.50   £
`;
}

export interface ContractInvoiceOptions {
  number?: string;
  orderRef?: string;
  jobNo?: string;
  accountNo?: string;
}

/**
 * Layout 2, "contract": "Label:" headers, a site address block, one block per item whose
 * description holds the fleet code in brackets and "£rate per week for N weeks M days".
 * Two items (one off hired during the month), a 20% damage waiver and a collection charge.
 */
export function contractInvoice(options: ContractInvoiceOptions = {}): string {
  const {
    number = "H512001",
    orderRef = "PO-26-0101",
    jobNo = "C300101",
    accountNo = "HT014",
  } = options;
  return `
                                                                                  Summit Access Ltd
HIRE INVOICE                                                                      Invoice No: ${number}
     Brookfield Build Ltd                             Site:           BROOKFIELD BUILD LTD
     1 Example Street                                                 CO:RIVERSIDE
     Testtown  TT1 1AA                                                1 River Road
                                                                      London  SE1 9ZZ
                                                      Invoice Date:   31/08/2026
                                                      Order No:       ${orderRef}
                                           ${accountNo.padEnd(9)}  Contract No.    ${jobNo}
Date From      Date To      Description                                                            Value
01/08/2026     31/08/2026   6.4m working height electric scissor (0.76m wide) (2201/17). £72.00 per    £331.20
                            week for 4 weeks 3 days  (hire continues...)
                            This Hire Contract commenced on 12/06/2026 & this invoice follows our
                            previous invoice no. H511800
01/08/2026     04/08/2026   Personnel hoist 2-person (2207/3 (T)). £90.00 per week for 2 days          £36.00
                            (item off hired on 04/08/2026)
                            All Risk Damage/Theft Waiver: Charged at 20% of the hire charge            £73.44
04/08/2026                  Collection                                                                 £85.00
VAT No. 000 000 000
NOTE: Additional charges may follow if applicable.                             Sub-Total     £525.64
Payment Terms: Strictly 30 days                                                VAT at 20%    £105.13
                                                                                    TOTAL    £630.77
`;
}

/** Layout 2 as a credit note: no periods, "Partial Credit of Hire of ...", amounts as credits. */
export function contractCreditNote(): string {
  return `
                                                                                  Summit Access Ltd
CREDIT NOTE                                                                       Credit Note No: H520050
     Brookfield Build Ltd                             Site:           BROOKFIELD BUILD LTD
     1 Example Street                                                 CO:RIVERSIDE
     Testtown  TT1 1AA                                                1 River Road
                                                                      London  SE1 9ZZ
                                                      Invoice Date:   30/09/2026     Order No:  PO-26-0101
                                           HT014      Advice Note:    A4410          Contract:C300101
Details                                                                                                Cost
Partial Credit of Hire of 6.4m working height electric scissor (0.76m wide) (2201/17)                  £14.40
Partial Credit of All Risk Damage/Theft Waiver: Charged at 20% of the hire charge                      £2.88
                            Credit of Invoice No. H512001 (Hire Contract No. C300101)
VAT No. 000 000 000
                                                                               Sub-Total     £17.28
                                                                               VAT at 20%    £3.46
                                                                                    TOTAL    £20.74
`;
}

export interface StatementOptions {
  accountNo?: string;
  date?: string;
  /** Rows as printed: [invoice date, job no, invoice no, customer ref, amount]. */
  rows?: [string, string, string, string, number][];
}

const money = (value: number) =>
  Math.abs(value).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * A supplier statement in the despatch supplier's layout: the invoices still open on the date,
 * debits and credits (credits printed negative in the Credit column), a customer reference that
 * can wrap onto the next row, a copy of each row on the right for the remittance, and the total.
 * The default rows: two August invoices, a return and a credit note, total £1,355.28.
 */
export function despatchStatement(options: StatementOptions = {}): string {
  const {
    accountNo = "APX-000123",
    date = "02/09/2026",
    rows = [
      ["31/07/2026", "170200345", "30390001", "Riverside", 665.28],
      ["31/08/2026", "170200345", "30451207", "RIVERSIDE", 665.28],
      ["02/09/2026", "170200400", "30451300", "Northgate Works Leeds", 56.4],
      ["30/08/2026", "170200345", "30460001", "Riverside", -31.68],
    ],
  } = options;
  const total = rows.reduce((sum, row) => sum + row[4], 0);
  const body = rows.flatMap(([invoiceDate, jobNo, invoiceNo, ref, amount]) => {
    // A long customer reference wraps: its last word goes on the row below.
    const words = ref.split(" ");
    const [first, rest] =
      words.length > 2 ? [words.slice(0, -1).join(" "), words.at(-1)] : [ref, ""];
    const left = ` ${invoiceDate}   ${jobNo.padEnd(11)}  ${invoiceNo.padEnd(12)}  ${first.padEnd(22)}`;
    const debit = amount >= 0 ? money(amount).padStart(9) : "".padStart(9);
    const credit = amount < 0 ? `-${money(amount)}`.padStart(10) : "".padStart(10);
    const copy = `   ${invoiceDate}   ${invoiceNo.padEnd(12)}  ${debit}  ${credit}`;
    const row = `${left}  ${debit}  ${credit}${copy}`;
    return rest ? [row, `${"".padEnd(41)}${rest}`] : [row];
  });
  return `
                                                              Group Statement         Account:   ${accountNo} BROOKFIELD BUILD LTD
 Brookfield Build Ltd                                                                 Date:      ${date}
 1 Example Street                                             Account:    ${accountNo}
 TT1 1AA                                                      Date:       ${date}
 Date         Job No.      Invoice No.   Customer Ref                Debit      Credit   Date         Invoice No.       Debit      Credit
${body.join("\n")}
 Period Ending:                                                    Total                                            Total
 30/09/2026      0.00   31/07/2026   665.28                ${money(total).padStart(9)}                                           Cheque
 31/08/2026    690.00   30/06/2026     0.00
 * = PART PAID Q = UNDER QUERY
`;
}
