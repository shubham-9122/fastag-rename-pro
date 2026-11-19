import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import JSZip from "jszip";
import { createVehicleHistoryWorkbook } from "./historyExport.js";
import "./style.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const nameInput = document.querySelector("#name-input");
const dateInput = document.querySelector("#date-input");
const fileInput = document.querySelector("#file-input");
const dropZone = document.querySelector("#drop-zone");
const filesSection = document.querySelector("#files-section");
const fileList = document.querySelector("#file-list");
const fileCount = document.querySelector("#file-count");
const downloadButton = document.querySelector("#download-button");
const downloadHint = document.querySelector("#download-hint");
const exampleName = document.querySelector("#example-name");
const toast = document.querySelector("#toast");
const installButton = document.querySelector("#install-button");
const historyList = document.querySelector("#history-list");
const historyEmpty = document.querySelector("#history-empty");
const exportHistoryButton = document.querySelector("#export-history-button");

const vehiclePattern = /^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$/i;
const vehiclesPattern = /[A-Z]{2}\s?\d{2}\s?[A-Z]{1,3}\s?\d{4}/gi;
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const historyStorageKey = "fastag-renamer-history-v1";
let reports = [];
let history = loadHistory();
let toastTimer;
let deferredInstallPrompt;

dateInput.value = localDateValue(new Date());
render();

nameInput.addEventListener("input", render);
dateInput.addEventListener("input", render);
fileInput.addEventListener("change", async () => {
  await addFiles([...fileInput.files]);
  fileInput.value = "";
});
exportHistoryButton.addEventListener("click", exportHistory);
document.querySelector("#clear-button").addEventListener("click", () => {
  reports = [];
  render();
});
downloadButton.addEventListener("click", downloadReports);

for (const eventName of ["dragenter", "dragover"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("is-dragging");
  });
}
for (const eventName of ["dragleave", "drop"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-dragging");
  });
}
dropZone.addEventListener("drop", async (event) => {
  await addFiles([...(event.dataTransfer?.files ?? [])]);
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});
installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  await deferredInstallPrompt.prompt();
  deferredInstallPrompt = null;
  installButton.hidden = true;
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("Could not register the offline app worker.", error);
    });
  });
}

async function addFiles(files) {
  const pdfFiles = files.filter((file) => file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf");
  if (pdfFiles.length !== files.length) showToast("Only PDF files can be added.");
  if (pdfFiles.length === 0) return;

  reports = [];
  render();
  const newReports = pdfFiles.map((file) => ({
    id: crypto.randomUUID(),
    file,
    vehicle: "",
    status: "Reading report…",
    error: "",
    ready: false,
  }));
  reports = newReports;
  render();

  for (const report of newReports) {
    const fromFilename = report.file.name.match(vehiclesPattern)?.[0];
    if (fromFilename) {
      report.vehicle = normalizeVehicle(fromFilename);
      report.status = "Vehicle number found in filename";
      report.ready = true;
      render();
      continue;
    }

    try {
      const text = await readPdfText(report.file);
      const fromPdf = text.match(vehiclesPattern)?.[0];
      if (fromPdf) {
        report.vehicle = normalizeVehicle(fromPdf);
        report.status = "Vehicle number found in PDF";
      } else {
        report.status = "Vehicle number not found";
        report.error = "Enter the vehicle number below to continue.";
      }
    } catch (error) {
      console.error(`Could not read ${report.file.name}.`, error);
      report.status = "Could not read PDF";
      report.error = "Enter the vehicle number below, or choose a valid, readable PDF.";
    }
    report.ready = true;
    render();
  }
}

async function readPdfText(file) {
  const document = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const pageTexts = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pageTexts.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  return pageTexts.join(" ");
}

function render() {
  const date = parseDateInput(dateInput.value);
  const prefix = safeNamePart(nameInput.value);
  const previewVehicle = "BR10AL3536";
  exampleName.textContent = `${prefix || "Name"}_${previewVehicle}_fastag_report_${date ? formatDate(date) : "DD MonYY"}.pdf`;

  filesSection.hidden = reports.length === 0;
  fileCount.textContent = String(reports.length);
  fileList.replaceChildren(...reports.map(renderReport));
  renderHistory();

  const canDownload = reports.length > 0
    && Boolean(prefix)
    && Boolean(date)
    && reports.every((report) => report.ready && vehiclePattern.test(report.vehicle));
  downloadButton.disabled = !canDownload;

  if (!prefix) downloadHint.textContent = "Enter a name or prefix to continue.";
  else if (!date) downloadHint.textContent = "Choose a valid report date to continue.";
  else if (reports.some((report) => !report.ready)) downloadHint.textContent = "Reading PDF files…";
  else if (reports.some((report) => !vehiclePattern.test(report.vehicle))) downloadHint.textContent = "Enter a valid vehicle number for each report.";
  else downloadHint.textContent = "Files will be bundled into one ZIP.";
}

function renderHistory() {
  exportHistoryButton.disabled = history.length === 0;
  historyEmpty.hidden = history.length > 0;
  historyList.replaceChildren(...[...history].reverse().map((entry) => {
    const row = document.createElement("article");
    row.className = "history-entry";
    const details = document.createElement("div");
    details.className = "history-details";
    const vehicle = document.createElement("strong");
    vehicle.textContent = entry.vehicleNumber;
    const prefix = document.createElement("span");
    prefix.textContent = `Prefix: ${entry.prefix}`;
    const fileName = document.createElement("span");
    fileName.className = "history-file-name";
    fileName.textContent = entry.renamedFile;
    fileName.title = entry.renamedFile;
    details.append(vehicle, prefix, fileName);
    const date = document.createElement("time");
    date.className = "history-date";
    date.dateTime = entry.recordedAt;
    date.textContent = entry.reportDate;
    row.append(details, date);
    return row;
  }));
}

function renderReport(report) {
  const card = document.createElement("article");
  card.className = "file-card";

  const top = document.createElement("div");
  top.className = "file-card-top";
  const icon = document.createElement("span");
  icon.className = "pdf-icon";
  icon.textContent = "PDF";
  const title = document.createElement("div");
  title.className = "file-title";
  const fileName = document.createElement("strong");
  fileName.textContent = report.file.name;
  fileName.title = report.file.name;
  const status = document.createElement("span");
  status.className = `file-status${report.error ? " has-error" : ""}`;
  status.textContent = report.status;
  title.append(fileName, status);
  const remove = document.createElement("button");
  remove.className = "remove-button";
  remove.type = "button";
  remove.setAttribute("aria-label", `Remove ${report.file.name}`);
  remove.textContent = "×";
  remove.addEventListener("click", () => {
    reports = reports.filter((item) => item.id !== report.id);
    render();
  });
  top.append(icon, title, remove);
  card.append(top);

  const row = document.createElement("label");
  row.className = "vehicle-field";
  const label = document.createElement("span");
  label.textContent = "Vehicle number";
  const input = document.createElement("input");
  input.type = "text";
  input.autocomplete = "off";
  input.autocapitalize = "characters";
  input.spellcheck = false;
  input.placeholder = "e.g. BR10AL3536";
  input.value = report.vehicle;
  input.setAttribute("aria-label", `Vehicle number for ${report.file.name}`);
  input.addEventListener("input", () => {
    report.vehicle = input.value.toUpperCase().replace(/\s+/g, "");
    report.error = "";
    updateOutputName(report, card);
    updateDownloadState();
  });
  row.append(label, input);
  card.append(row);

  const output = document.createElement("div");
  output.className = "output-name";
  output.innerHTML = "<span>NEW FILE NAME</span>";
  const outputValue = document.createElement("strong");
  outputValue.className = "output-value";
  output.append(outputValue);
  card.append(output);
  updateOutputName(report, card);
  return card;
}

function updateOutputName(report, card) {
  const outputValue = card.querySelector(".output-value");
  outputValue.textContent = reportOutputName(report) ?? "Complete the details above";
}

function updateDownloadState() {
  const canDownload = reports.length > 0
    && Boolean(safeNamePart(nameInput.value))
    && Boolean(parseDateInput(dateInput.value))
    && reports.every((report) => report.ready && vehiclePattern.test(report.vehicle));
  downloadButton.disabled = !canDownload;
  if (reports.some((report) => !vehiclePattern.test(report.vehicle))) {
    downloadHint.textContent = "Enter a valid vehicle number for each report.";
  } else if (canDownload) {
    downloadHint.textContent = "Files will be bundled into one ZIP.";
  }
}

async function downloadReports() {
  if (downloadButton.disabled) return;
  downloadButton.disabled = true;
  downloadButton.classList.add("is-loading");
  downloadButton.querySelector("span:first-child").textContent = "Preparing your files…";
  try {
    const zip = new JSZip();
    for (const report of reports) {
      zip.file(reportOutputName(report), report.file);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const newHistory = reports.map((report) => ({
      vehicleNumber: normalizeVehicle(report.vehicle),
      prefix: safeNamePart(nameInput.value),
      reportDate: formatDate(parseDateInput(dateInput.value)),
      originalFile: report.file.name,
      renamedFile: reportOutputName(report),
      recordedAt: new Date().toISOString(),
    }));
    history = [...history, ...newHistory];
    let historySaved = true;
    try {
      localStorage.setItem(historyStorageKey, JSON.stringify(history));
    } catch (error) {
      historySaved = false;
      console.error("Could not save vehicle history on this device.", error);
    }

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "renamed-fastag-reports.zip";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(historySaved
      ? `${reports.length} renamed PDF${reports.length === 1 ? "" : "s"} downloaded and added to history.`
      : "PDFs downloaded, but history could not be saved on this device.");
  } catch (error) {
    console.error("Could not create the ZIP download.", error);
    showToast("Could not prepare the ZIP. Please try again.");
  } finally {
    downloadButton.classList.remove("is-loading");
    downloadButton.querySelector("span:first-child").textContent = "Download renamed PDFs";
    render();
  }
}

async function exportHistory() {
  if (history.length === 0) return;
  exportHistoryButton.disabled = true;
  try {
    const blob = await createVehicleHistoryWorkbook(history);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "fastag-vehicle-history.xlsx";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`${history.length} vehicle history record${history.length === 1 ? "" : "s"} exported to Excel.`);
  } catch (error) {
    console.error("Could not export vehicle history to Excel.", error);
    showToast("Could not export the Excel file. Please try again.");
  } finally {
    exportHistoryButton.disabled = history.length === 0;
  }
}

function loadHistory() {
  try {
    const stored = localStorage.getItem(historyStorageKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.some((entry) => (
      typeof entry.vehicleNumber !== "string"
      || typeof entry.prefix !== "string"
      || typeof entry.reportDate !== "string"
      || typeof entry.originalFile !== "string"
      || typeof entry.renamedFile !== "string"
      || typeof entry.recordedAt !== "string"
    ))) {
      throw new Error("Saved vehicle history has an invalid format.");
    }
    return parsed;
  } catch (error) {
    console.error("Could not load vehicle history from this device.", error);
    return [];
  }
}

function safeNamePart(value) {
  return value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").replace(/\s+/g, " ").replace(/[. ]+$/g, "");
}

function normalizeVehicle(value) {
  return value.toUpperCase().replace(/\s+/g, "");
}

function reportOutputName(report) {
  const prefix = safeNamePart(nameInput.value);
  const date = parseDateInput(dateInput.value);
  if (!prefix || !date || !vehiclePattern.test(report.vehicle)) return null;

  const base = `${prefix}_${normalizeVehicle(report.vehicle)}_fastag_report_${formatDate(date)}`;
  const reportIndex = reports.findIndex((item) => item.id === report.id);
  const duplicatesBefore = reports.slice(0, reportIndex).filter((item) => (
    `${prefix}_${normalizeVehicle(item.vehicle)}_fastag_report_${formatDate(date)}` === base
  )).length;
  const suffix = duplicatesBefore ? `_${duplicatesBefore + 1}` : "";
  return `${base}${suffix}.pdf`;
}

function localDateValue(date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function parseDateInput(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function formatDate(date) {
  const day = date.getDate();
  const suffix = day % 100 >= 11 && day % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[day % 10] ?? "th");
  return `${day}${suffix} ${monthNames[date.getMonth()]}${String(date.getFullYear()).slice(-2)}`;
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3200);
}
