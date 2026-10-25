import { MS_PER_DAY, parseIsoDate, type IsoDate } from "@/lib/charging/iso-date";
import { money } from "@/lib/reconciliation/helpers";
import type { RegisterRow } from "./on-hire-register";

export type RowWithSite = RegisterRow & { site: { id: string; code: string; name: string } };

export interface AlertSettings {
  /** An item on hire this many days or more is a long hire. */
  longHireDays: number;
  /** An item that has cost this much (pounds) or more so far is costly. */
  costLimit: number;
  /** An off-hired item not collected after this many days should be chased. */
  collectionDays: number;
}

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  longHireDays: 84,
  costLimit: 1000,
  collectionDays: 7,
};

export type HireAlertKind = "NOT_COLLECTED" | "LONG_HIRE" | "COSTLY";

export interface HireAlert {
  kind: HireAlertKind;
  site: RowWithSite["site"];
  itemId: string;
  supplierJobNo: string;
  supplierName: string;
  description: string;
  fleetCode: string | null;
  costToDate: number;
  message: string;
}

const KIND_ORDER: HireAlertKind[] = ["NOT_COLLECTED", "LONG_HIRE", "COSTLY"];

const daysBetween = (from: IsoDate, to: IsoDate) =>
  Math.round((parseIsoDate(to) - parseIsoDate(from)) / MS_PER_DAY);

/**
 * Hires worth a look, from the on-hire register: an item on hire for a long time (still
 * needed?), an item that has cost a lot (buy instead?), an off-hired item still waiting to be
 * collected (it is still costing money). Listed by site, the most urgent first.
 */
export function hireAlerts(
  rows: RowWithSite[],
  asOf: IsoDate,
  settings: AlertSettings,
): HireAlert[] {
  const alerts: HireAlert[] = [];
  for (const row of rows) {
    const item = `${row.description}${row.fleetCode ? ` (${row.fleetCode})` : ""}`;
    const alert = (kind: HireAlertKind, message: string): HireAlert => ({
      kind,
      site: row.site,
      itemId: row.itemId,
      supplierJobNo: row.supplierJobNo,
      supplierName: row.supplierName,
      description: row.description,
      fleetCode: row.fleetCode,
      costToDate: row.costToDate,
      message,
    });
    if (row.status === "OFF_HIRED" && row.offHireDate) {
      const days = daysBetween(row.offHireDate, asOf);
      if (days > settings.collectionDays) {
        alerts.push(
          alert(
            "NOT_COLLECTED",
            `${item} was off hired on ${row.offHireDate}, ${days} days ago, and is not collected yet: chase the collection`,
          ),
        );
      }
    }
    if (row.status === "ON_HIRE" && row.calendarDaysOnHire >= settings.longHireDays) {
      const weeks = Math.floor(row.calendarDaysOnHire / 7);
      alerts.push(
        alert(
          "LONG_HIRE",
          `${item} has been on hire for ${weeks} weeks, since ${row.startDate}: is it still needed on site?`,
        ),
      );
    }
    if (row.status === "ON_HIRE" && row.costToDate >= settings.costLimit) {
      alerts.push(
        alert(
          "COSTLY",
          `${item} has cost ${money(row.costToDate)} so far at ${money(row.weeklyRate)}/week: would buying it, or a cheaper item, save money?`,
        ),
      );
    }
  }
  return alerts.sort(
    (a, b) =>
      a.site.code.localeCompare(b.site.code) ||
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind),
  );
}
