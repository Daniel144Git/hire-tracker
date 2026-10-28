export interface SiteForRecognition {
  id: string;
  code: string;
  name: string;
  deliveryAddress: string | null;
  /** Customer references recorded for the site, already normalised. */
  aliases: string[];
}

export type SiteMatch = "ALIAS" | "NAME" | "CODE" | "ADDRESS" | "POSTCODE";

export interface SiteRecognition {
  siteId: string | null;
  matchedBy: SiteMatch | null;
  /** Every site that fitted: one when recognised, several when ambiguous, none otherwise. */
  candidates: string[];
}

/** "  riverside-tower, blk.B " -> "RIVERSIDE TOWER BLK B". Used to compare and to store aliases. */
export function normaliseReference(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

const UK_POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?) ?(\d[A-Z]{2})\b/;

function postcodeOf(address: string | null | undefined): string | null {
  const match = address ? UK_POSTCODE.exec(address.toUpperCase()) : null;
  return match ? `${match[1]} ${match[2]}` : null;
}

/**
 * Which site an invoice is for, from the customer reference as the supplier typed it
 * (inconsistently: "RIVERSIDE", "Riverside Twr", "riverside") and the delivery address.
 * In order: a recorded alias, the site name, the site code as a word, every word of the
 * reference in the name, then a recorded alias or the site name in a line of the delivery
 * address (the reference is sometimes a PO number), then the postcode of the delivery address.
 * It never guesses: when a rule fits more than one site, the sites are returned as candidates
 * and no site is chosen.
 */
export function recognizeSite(
  printed: { customerRef?: string | null; deliveryAddress?: string | null },
  sites: SiteForRecognition[],
): SiteRecognition {
  const ref = normaliseReference(printed.customerRef ?? "");
  const words = ref.split(" ").filter(Boolean);
  const postcode = postcodeOf(printed.deliveryAddress);
  // Each address line, padded so a phrase only matches whole words: " RIVERSIDE TOWER 1 RIVER ROAD ".
  const addressLines = (printed.deliveryAddress ?? "")
    .split(",")
    .map((line) => ` ${normaliseReference(line)} `);
  const inAddress = (phrase: string) =>
    phrase !== "" && addressLines.some((line) => line.includes(` ${phrase} `));

  const rules: [SiteMatch, (site: SiteForRecognition) => boolean][] = [
    ["ALIAS", (site) => ref !== "" && site.aliases.includes(ref)],
    ["NAME", (site) => ref !== "" && normaliseReference(site.name) === ref],
    ["CODE", (site) => words.includes(site.code.toUpperCase())],
    [
      "NAME",
      (site) => {
        const nameWords = normaliseReference(site.name).split(" ");
        return words.length > 0 && words.every((word) => nameWords.includes(word));
      },
    ],
    ["ADDRESS", (site) => [...site.aliases, normaliseReference(site.name)].some(inAddress)],
    ["POSTCODE", (site) => postcode !== null && postcodeOf(site.deliveryAddress) === postcode],
  ];

  for (const [matchedBy, fits] of rules) {
    const candidates = sites.filter(fits).map((site) => site.id);
    if (candidates.length === 1) return { siteId: candidates[0], matchedBy, candidates };
    if (candidates.length > 1) return { siteId: null, matchedBy: null, candidates };
  }
  return { siteId: null, matchedBy: null, candidates: [] };
}
