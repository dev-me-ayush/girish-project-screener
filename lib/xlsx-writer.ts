/**
 * Minimal dependency-free .xlsx writer (STORE-method ZIP + SpreadsheetML).
 * SheetJS-CE drops cell styles on write, so we emit the package ourselves:
 * styled header, direction tints, numeric formats, autofilter, column widths.
 * Output verified: valid ZIP, complete OOXML parts, opens in Excel/Sheets.
 */

function crc32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = crc32Table();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(v: number): Uint8Array {
  return new Uint8Array([v & 0xff, (v >>> 8) & 0xff]);
}

function u32(v: number): Uint8Array {
  return new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

const enc = new TextEncoder();

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/** STORE (uncompressed) ZIP — universally readable, no compression lib needed. */
export function buildZip(entries: ZipEntry[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const crc = crc32(e.data);
    const header = concat([
      u32(0x04034b50),
      u16(20), // version needed
      u16(0x0800), // UTF-8 flag
      u16(0), // method STORE
      u16(0), // mod time
      u16(0), // mod date
      u32(crc),
      u32(e.data.length),
      u32(e.data.length),
      u16(nameBytes.length),
      u16(0), // extra len
    ]);
    localParts.push(header, nameBytes, e.data);

    centralParts.push(
      concat([
        u32(0x02014b50),
        u16(20), // version made by
        u16(20), // version needed
        u16(0x0800),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(e.data.length),
        u32(e.data.length),
        u16(nameBytes.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0), // external attrs
        u32(offset),
      ]),
      nameBytes
    );
    offset += header.length + nameBytes.length + e.data.length;
  }

  const local = concat(localParts);
  const central = concat(centralParts);
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(central.length),
    u32(local.length),
    u16(0),
  ]);
  return concat([local, central, end]);
}

export type CellValue = string | number | null;

export interface SheetSpec {
  name: string;
  headers: string[];
  rows: CellValue[][];
  /** per-column widths (characters) */
  widths: number[];
  /** row style pickers */
  rowStyle?: (rowIndex: number) => { statusCol?: number; tone?: "up" | "down" | "none" };
  /** columns where negative numbers render dark-red */
  negRedCols?: Set<number>;
  /** numeric columns rendered as integers (no decimals) */
  intCols?: Set<number>;
}

function esc(s: string): string {
  // Strip control chars illegal in XML 1.0, then escape markup.
  const cleaned = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
  return cleaned.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function colLetter(i: number): string {
  let s = "";
  let n = i;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="#,##0"/></numFmts>
<fonts count="4">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FF991B1B"/><name val="Calibri"/></font>
</fonts>
<fills count="5">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF18181B"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF4F4F5"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFEE2E2"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="7">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFill="1" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="4" borderId="0" xfId="0" applyFill="1" applyFont="1"/>
<xf numFmtId="164" fontId="3" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
</styleSheet>`;

// cellXfs indexes: 0 default | 1 header | 2 number | 3 up | 4 down | 5 negative number | 6 integer

function sheetXml(spec: SheetSpec): string {
  const nCols = spec.headers.length;
  const nRows = spec.rows.length + 1;
  const lastCol = colLetter(nCols - 1);
  const cols = spec.headers
    .map((_, i) => `<col min="${i + 1}" max="${i + 1}" width="${spec.widths[i] || 12}" customWidth="1"/>`)
    .join("");

  const renderCell = (r: number, c: number, v: CellValue, style: number): string => {
    const ref = `${colLetter(c)}${r}`;
    if (v === null || v === undefined || v === "") return `<c r="${ref}" s="${style}"/>`;
    if (typeof v === "number") {
      if (!Number.isFinite(v)) return `<c r="${ref}" s="${style}"/>`;
      return `<c r="${ref}" s="${style}"><v>${v}</v></c>`;
    }
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`;
  };

  let rowsXml = `<row r="1">${spec.headers.map((h, c) => renderCell(1, c, h, 1)).join("")}</row>`;
  spec.rows.forEach((row, i) => {
    const r = i + 2;
    const rs = spec.rowStyle?.(i);
    const cells = row
      .map((v, c) => {
        let style = 0;
        if (typeof v === "number") {
          if (spec.negRedCols?.has(c) && v < 0) style = 5;
          else if (spec.intCols?.has(c)) style = 6;
          else style = 2;
        }
        if (rs?.statusCol === c) {
          style = rs.tone === "up" ? 3 : rs.tone === "down" ? 4 : 0;
        }
        return renderCell(r, c, v, style);
      })
      .join("");
    rowsXml += `<row r="${r}">${cells}</row>`;
  });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="A1:${lastCol}${nRows}"/>
<sheetViews><sheetView workbookViewId="0"/></sheetViews>
<sheetFormat defaultRowHeight="15"/>
<cols>${cols}</cols>
<sheetData>${rowsXml}</sheetData>
<autoFilter ref="A1:${lastCol}${nRows}"/>
</worksheet>`;
}

export function buildWorkbook(sheets: SheetSpec[]): Uint8Array {
  const sheetRels = sheets
    .map(
      (s, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
    )
    .join("");
  const sheetEntries = sheets
    .map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join("");

  const entries: ZipEntry[] = [
    {
      name: "[Content_Types].xml",
      data: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets
          .map(
            (_, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
          )
          .join("")}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`
      ),
    },
    {
      name: "_rels/.rels",
      data: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
      ),
    },
    {
      name: "xl/workbook.xml",
      data: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetEntries}</sheets></workbook>`
      ),
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId0" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${sheetRels}</Relationships>`
      ),
    },
    { name: "xl/styles.xml", data: enc.encode(STYLES_XML) },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: enc.encode(sheetXml(s)) })),
  ];

  return buildZip(entries);
}
