import assert from "node:assert/strict";
import { test } from "node:test";
import JSZip from "jszip";
import { createVehicleHistoryWorkbook } from "../src/historyExport.js";

test("exports every vehicle and prefix as a valid Excel workbook", async () => {
  const history = [
    {
      vehicleNumber: "BR10AL3536",
      prefix: "Shubham & Company",
      reportDate: "18th Nov26",
      originalFile: "original.pdf",
      renamedFile: "Shubham_BR10AL3536_fastag_report_18th Nov26.pdf",
      recordedAt: "2026-11-18T12:00:00.000Z",
    },
    {
      vehicleNumber: "MH01AB1234",
      prefix: "Office",
      reportDate: "19th Nov26",
      originalFile: "report.pdf",
      renamedFile: "Office_MH01AB1234_fastag_report_19th Nov26.pdf",
      recordedAt: "2026-11-19T12:00:00.000Z",
    },
  ];

  const blob = await createVehicleHistoryWorkbook(history);
  const workbook = await JSZip.loadAsync(await blob.arrayBuffer());
  const worksheet = await workbook.file("xl/worksheets/sheet1.xml").async("string");
  const excelTypes = await workbook.file("[Content_Types].xml").async("string");

  assert.match(excelTypes, /spreadsheetml\.sheet\.main\+xml/);
  assert.match(worksheet, /Vehicle Number/);
  assert.match(worksheet, /Shubham &amp; Company/);
  assert.match(worksheet, /BR10AL3536/);
  assert.match(worksheet, /MH01AB1234/);
  assert.match(worksheet, /Office_MH01AB1234_fastag_report_19th Nov26\.pdf/);
  assert.match(worksheet, /<autoFilter ref="A1:F3"\/>/);
});
