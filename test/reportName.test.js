import assert from "node:assert/strict";
import { test } from "node:test";
import { createReportFileName } from "../src/reportName.js";

test("formats the report name to match the requested style", () => {
  assert.equal(
    createReportFileName("Magma", "MH25AJ5225", new Date(2026, 10, 19)),
    "Magma_MH25AJ5225_FASTag_Report_19th Nov26",
  );
});

test("uses the correct ordinal for teen dates", () => {
  assert.equal(
    createReportFileName("Magma", "MH25AJ5225", new Date(2026, 10, 12)),
    "Magma_MH25AJ5225_FASTag_Report_12th Nov26",
  );
});

test("adds a suffix to duplicate report names", () => {
  assert.equal(
    createReportFileName("Magma", "MH25AJ5225", new Date(2026, 10, 19), 1),
    "Magma_MH25AJ5225_FASTag_Report_19th Nov26_2",
  );
});
