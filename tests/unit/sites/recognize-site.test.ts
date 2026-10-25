import { describe, expect, it } from "vitest";
import {
  normaliseReference,
  recognizeSite,
  type SiteForRecognition,
} from "@/lib/sites/recognize-site";

const sites: SiteForRecognition[] = [
  {
    id: "rvs",
    code: "RVS",
    name: "Riverside Tower",
    deliveryAddress: "1 Riverside Walk, Northport NP1 1AA",
    aliases: ["RIVERSIDE TWR"],
  },
  {
    id: "mlp",
    code: "MLP",
    name: "Mill Lane Primary School",
    deliveryAddress: "Mill Lane, Easton EA4 2BB",
    aliases: [],
  },
  {
    id: "ngw",
    code: "NGW",
    name: "Northgate Wharf",
    deliveryAddress: "Wharf Road, Northport NP3 7CC",
    aliases: [],
  },
];

describe("normaliseReference", () => {
  it("upper-cases and keeps only letters and digits, single-spaced", () => {
    expect(normaliseReference("  riverside-tower, blk.B ")).toBe("RIVERSIDE TOWER BLK B");
  });
});

describe("recognizeSite: which site an invoice is for, from how the supplier wrote it", () => {
  it.each([
    ["Riverside Twr", "rvs", "ALIAS"],
    ["riverside tower", "rvs", "NAME"],
    ["RIVERSIDE", "rvs", "NAME"],
    ["Mill Lane School", "mlp", "NAME"],
    ["RVS - Block B", "rvs", "CODE"],
  ])("recognises %s as %s (by %s)", (customerRef, siteId, matchedBy) => {
    expect(recognizeSite({ customerRef }, sites)).toEqual({
      siteId,
      matchedBy,
      candidates: [siteId],
    });
  });

  it("uses the postcode of the delivery address when the reference says nothing", () => {
    const result = recognizeSite(
      { customerRef: "Block B", deliveryAddress: "Unit 4, Wharf Rd, Northport NP3 7CC" },
      sites,
    );

    expect(result).toEqual({ siteId: "ngw", matchedBy: "POSTCODE", candidates: ["ngw"] });
  });

  it("prefers an alias the user recorded over a guess from the name", () => {
    const withAlias = sites.map((s) => (s.id === "ngw" ? { ...s, aliases: ["RIVERSIDE"] } : s));

    expect(recognizeSite({ customerRef: "Riverside" }, withAlias).siteId).toBe("ngw");
  });

  it("does not guess when the words fit more than one site", () => {
    const withDepot = [
      ...sites,
      { id: "mrd", code: "MRD", name: "Mill Road Depot", deliveryAddress: null, aliases: [] },
    ];

    expect(recognizeSite({ customerRef: "MILL" }, withDepot)).toEqual({
      siteId: null,
      matchedBy: null,
      candidates: ["mlp", "mrd"],
    });
  });

  it("returns no site when nothing matches", () => {
    expect(recognizeSite({ customerRef: "ACME HQ" }, sites)).toEqual({
      siteId: null,
      matchedBy: null,
      candidates: [],
    });
  });
});
