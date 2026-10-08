import ExcelJS from "exceljs";

export interface HistoryRowExport {
  time: string;
  strikes: Array<{
    strike: number;
    callOIChange: number;
    putOIChange: number;
  }>;
  totalCallOIChange: number;
  totalPutOIChange: number;
  difference: number;
  changeDiff: number;
  revSignal: boolean;
}

export interface ExportOptionsMetadata {
  indexName: string;
  expiry: string;
  intervalMinutes: number;
  activeStrikes: number[];
}

/**
 * Builds standard CSV string representation of the Three Strike Range Change in OI Analysis table.
 */
export function generateHistoryCSV(
  rows: HistoryRowExport[],
  meta: ExportOptionsMetadata
): string {
  const { activeStrikes } = meta;
  const s1 = activeStrikes[0] || "Strike 1";
  const s2 = activeStrikes[1] || "Strike 2";
  const s3 = activeStrikes[2] || "Strike 3";

  const lines: string[] = [];

  // Metadata headers
  lines.push(`Index,${meta.indexName},Expiry,${meta.expiry},Interval,${meta.intervalMinutes} Minutes`);
  lines.push("");

  // Table headers (Flattened 2-row representation for CSV compatibility)
  lines.push(
    [
      "Time",
      `${s1} CALL`,
      `${s1} PUT`,
      `${s2} CALL`,
      `${s2} PUT`,
      `${s3} CALL`,
      `${s3} PUT`,
      "CALL OI Change",
      "PUT OI Change",
      "Difference",
      "Change% diff (Δ)",
      "Rev. Signal",
    ].join(",")
  );

  for (const row of rows) {
    const s1Data = row.strikes[0];
    const s2Data = row.strikes[1];
    const s3Data = row.strikes[2];

    const fields = [
      row.time,
      s1Data?.callOIChange ?? 0,
      s1Data?.putOIChange ?? 0,
      s2Data?.callOIChange ?? 0,
      s2Data?.putOIChange ?? 0,
      s3Data?.callOIChange ?? 0,
      s3Data?.putOIChange ?? 0,
      row.totalCallOIChange,
      row.totalPutOIChange,
      row.difference,
      row.changeDiff,
      row.revSignal ? "REVERSAL" : "-",
    ];
    lines.push(fields.join(","));
  }

  return lines.join("\r\n");
}

/**
 * Generates an ExcelJS workbook with high-contrast, production styling and color-coding.
 */
export async function createHistoryExcelWorkbook(
  rows: HistoryRowExport[],
  meta: ExportOptionsMetadata
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Tessera Options Analytics";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("OI Analysis", {
    views: [{ state: "frozen", ySplit: 5 }],
  });

  const { activeStrikes } = meta;
  const [s1, s2, s3] = activeStrikes;

  // Title / Metadata block (Rows 1-3)
  worksheet.mergeCells("A1:L1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = `${meta.indexName} - Three Strike Range Change in OI Analysis`;
  titleCell.font = { name: "Segoe UI", size: 14, bold: true, color: { argb: "FF0F172A" } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  worksheet.getRow(1).height = 24;

  worksheet.mergeCells("A2:L2");
  const metaCell = worksheet.getCell("A2");
  metaCell.value = `Expiry: ${meta.expiry}  |  Interval: ${meta.intervalMinutes} Minutes  |  Strikes: (${activeStrikes.join(", ")})  |  Generated: ${new Date().toLocaleDateString("en-IN")} ${new Date().toLocaleTimeString("en-IN")}`;
  metaCell.font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "FF64748B" } };
  metaCell.alignment = { vertical: "middle", horizontal: "left" };
  worksheet.getRow(2).height = 18;

  worksheet.getRow(3).height = 8; // Spacer

  // Header Row 1 (Row 4)
  worksheet.mergeCells("A4:A5");
  worksheet.getCell("A4").value = "Time";

  worksheet.mergeCells("B4:C4");
  worksheet.getCell("B4").value = s1 ? `${s1}` : "Strike 1";

  worksheet.mergeCells("D4:E4");
  worksheet.getCell("D4").value = s2 ? `${s2}` : "Strike 2";

  worksheet.mergeCells("F4:G4");
  worksheet.getCell("F4").value = s3 ? `${s3}` : "Strike 3";

  worksheet.mergeCells("H4:H5");
  worksheet.getCell("H4").value = "CALL OI Change";

  worksheet.mergeCells("I4:I5");
  worksheet.getCell("I4").value = "PUT OI Change";

  worksheet.mergeCells("J4:J5");
  worksheet.getCell("J4").value = "Difference";

  worksheet.mergeCells("K4:K5");
  worksheet.getCell("K4").value = "Change% diff (Δ)";

  worksheet.mergeCells("L4:L5");
  worksheet.getCell("L4").value = "Rev. Signal";

  worksheet.getRow(4).height = 22;

  // Header Row 2 (Row 5) - Sub-headers for CE/PE
  worksheet.getCell("B5").value = "CALL";
  worksheet.getCell("C5").value = "PUT";
  worksheet.getCell("D5").value = "CALL";
  worksheet.getCell("E5").value = "PUT";
  worksheet.getCell("F5").value = "CALL";
  worksheet.getCell("G5").value = "PUT";
  worksheet.getRow(5).height = 18;

  // Styling Header Cells
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFCBD5E1" } },
    bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
    left: { style: "thin", color: { argb: "FFCBD5E1" } },
    right: { style: "thin", color: { argb: "FFCBD5E1" } },
  };

  const applyHeaderStyle = (
    cellRef: string,
    bgColor: string,
    textColor: string,
    fontSize = 10,
    align: "left" | "center" | "right" = "center"
  ) => {
    const c = worksheet.getCell(cellRef);
    c.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: bgColor },
    };
    c.font = { name: "Segoe UI", bold: true, size: fontSize, color: { argb: textColor } };
    c.alignment = { vertical: "middle", horizontal: align };
    c.border = thinBorder;
  };

  applyHeaderStyle("A4", "FFF1F5F9", "FF0F172A", 10, "center");

  // Strikes Top
  applyHeaderStyle("B4", "FFE0F2FE", "FF0369A1", 10, "center");
  applyHeaderStyle("D4", "FFE0F2FE", "FF0369A1", 10, "center");
  applyHeaderStyle("F4", "FFE0F2FE", "FF0369A1", 10, "center");

  // Summary Headers
  applyHeaderStyle("H4", "FFFFE4E6", "FF9F1239", 10, "right");
  applyHeaderStyle("I4", "FFD1FAE5", "FF065F46", 10, "right");
  applyHeaderStyle("J4", "FFFEF3C7", "FF78350F", 10, "right");
  applyHeaderStyle("K4", "FFFEF3C7", "FF78350F", 10, "right");
  applyHeaderStyle("L4", "FFF1F5F9", "FF0F172A", 10, "center");

  // Subheaders (Row 5)
  for (const col of ["B", "D", "F"]) {
    applyHeaderStyle(`${col}5`, "FFFFF1F2", "FFE11D48", 9, "right");
  }
  for (const col of ["C", "E", "G"]) {
    applyHeaderStyle(`${col}5`, "FFECFDF5", "FF059669", 9, "right");
  }

  // Populate Data Rows
  let curRow = 6;
  const numFmt = "#,##,##0";

  for (const row of rows) {
    const xlRow = worksheet.getRow(curRow);
    xlRow.height = 19;

    const s1Data = row.strikes[0];
    const s2Data = row.strikes[1];
    const s3Data = row.strikes[2];

    xlRow.getCell(1).value = row.time; // Time
    xlRow.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
    xlRow.getCell(1).font = { name: "Consolas", bold: true, size: 9.5 };

    const formatNumCell = (colIdx: number, val: number, colorARGB: string) => {
      const cell = xlRow.getCell(colIdx);
      cell.value = val;
      cell.numFmt = numFmt;
      cell.font = { name: "Consolas", size: 9.5, color: { argb: colorARGB } };
      cell.alignment = { vertical: "middle", horizontal: "right" };
      cell.border = thinBorder;
    };

    // S1 CE & PE
    formatNumCell(2, s1Data?.callOIChange ?? 0, "FFE11D48");
    formatNumCell(3, s1Data?.putOIChange ?? 0, "FF059669");

    // S2 CE & PE
    formatNumCell(4, s2Data?.callOIChange ?? 0, "FFE11D48");
    formatNumCell(5, s2Data?.putOIChange ?? 0, "FF059669");

    // S3 CE & PE
    formatNumCell(6, s3Data?.callOIChange ?? 0, "FFE11D48");
    formatNumCell(7, s3Data?.putOIChange ?? 0, "FF059669");

    // Totals
    formatNumCell(8, row.totalCallOIChange, "FFBE123C");
    xlRow.getCell(8).font = { name: "Consolas", bold: true, size: 9.5, color: { argb: "FFBE123C" } };

    formatNumCell(9, row.totalPutOIChange, "FF047857");
    xlRow.getCell(9).font = { name: "Consolas", bold: true, size: 9.5, color: { argb: "FF047857" } };

    // Difference
    const diffColor = row.difference >= 0 ? "FF047857" : "FFBE123C";
    formatNumCell(10, row.difference, diffColor);
    xlRow.getCell(10).font = { name: "Consolas", bold: true, size: 9.5, color: { argb: diffColor } };

    // Change% diff (Δ)
    const isDeltaPos = row.changeDiff > 0;
    const deltaCell = xlRow.getCell(11);
    deltaCell.value = row.changeDiff;
    deltaCell.numFmt = numFmt;
    deltaCell.font = {
      name: "Consolas",
      bold: true,
      size: 9.5,
      color: { argb: isDeltaPos ? "FF065F46" : "FF9F1239" },
    };
    deltaCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: isDeltaPos ? "FFECFDF5" : "FFFFF1F2" },
    };
    deltaCell.alignment = { vertical: "middle", horizontal: "right" };
    deltaCell.border = thinBorder;

    // Reversal Signal
    const sigCell = xlRow.getCell(12);
    sigCell.value = row.revSignal ? "REVERSAL" : "-";
    sigCell.alignment = { vertical: "middle", horizontal: "center" };
    sigCell.border = thinBorder;
    if (row.revSignal) {
      sigCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF059669" },
      };
      sigCell.font = { name: "Segoe UI", bold: true, size: 9, color: { argb: "FFFFFFFF" } };
    } else {
      sigCell.font = { name: "Segoe UI", size: 9, color: { argb: "FF94A3B8" } };
    }

    curRow++;
  }

  // Adjust Column Widths
  worksheet.getColumn(1).width = 11; // Time
  worksheet.getColumn(2).width = 14; // S1 Call
  worksheet.getColumn(3).width = 14; // S1 Put
  worksheet.getColumn(4).width = 14; // S2 Call
  worksheet.getColumn(5).width = 14; // S2 Put
  worksheet.getColumn(6).width = 14; // S3 Call
  worksheet.getColumn(7).width = 14; // S3 Put
  worksheet.getColumn(8).width = 17; // Call Total
  worksheet.getColumn(9).width = 17; // Put Total
  worksheet.getColumn(10).width = 16; // Diff
  worksheet.getColumn(11).width = 18; // Delta
  worksheet.getColumn(12).width = 14; // Rev Signal

  return workbook;
}

/**
 * Triggers client-side browser file download for a generated CSV string.
 */
export function downloadCSVFile(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Triggers client-side browser file download for an ExcelJS workbook.
 */
export async function downloadExcelFile(workbook: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
