import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { folderName, toCsv, toXlsx, toZip } from "@/lib/exports/files";

describe("toCsv", () => {
  it("writes rows, quoting cells with commas, quotes or new lines, money with 2 decimals", () => {
    expect(
      toCsv([
        ["Site", "Description", "Net"],
        ["RVS", 'Lift, 8m "electric"', 210],
        ["NGW", "Line 1\nLine 2", -4.2],
      ]),
    ).toBe(
      'Site,Description,Net\r\nRVS,"Lift, 8m ""electric""",210.00\r\nNGW,"Line 1\nLine 2",-4.20\r\n',
    );
  });

  it("guards against spreadsheet formulas in text", () => {
    expect(toCsv([["=HYPERLINK(1)", "+1", "-x", "@a"]])).toBe("'=HYPERLINK(1),'+1,'-x,'@a\r\n");
  });
});

describe("toXlsx", () => {
  it("writes an Excel workbook with one sheet per table, numbers as numbers", () => {
    const files = unzipSync(
      toXlsx([
        {
          name: "August 2026",
          rows: [
            ["Site", "Net"],
            ["RVS & Co <1>", 210.5],
          ],
        },
        { name: "Lines", rows: [["Invoice"]] },
      ]),
    );

    expect(Object.keys(files).sort()).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/_rels/workbook.xml.rels",
      "xl/workbook.xml",
      "xl/worksheets/sheet1.xml",
      "xl/worksheets/sheet2.xml",
    ]);
    expect(strFromU8(files["xl/workbook.xml"])).toContain('<sheet name="August 2026" sheetId="1"');
    const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]);
    expect(sheet).toContain('<c r="A2" t="inlineStr"><is><t>RVS &amp; Co &lt;1&gt;</t></is></c>');
    expect(sheet).toContain('<c r="B2"><v>210.5</v></c>');
  });
});

describe("toZip and folderName", () => {
  it("packs files under their folder paths", () => {
    const files = unzipSync(
      toZip({
        "RVS - Riverside Tower/summary.csv": "a,b\r\n",
        "readme.txt": new Uint8Array([104]),
      }),
    );
    expect(strFromU8(files["RVS - Riverside Tower/summary.csv"])).toBe("a,b\r\n");
    expect(strFromU8(files["readme.txt"])).toBe("h");
  });

  it("makes a safe folder name from a site", () => {
    expect(folderName({ code: "RVS", name: "Riverside Tower" })).toBe("RVS - Riverside Tower");
    expect(folderName({ code: "B/2", name: 'Block: "B" <new>' })).toBe("B-2 - Block- -B- -new-");
    expect(folderName(null)).toBe("No site");
  });
});
