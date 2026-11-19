const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function createReportFileName(prefix, vehicleNumber, date, duplicateIndex = 0) {
  const duplicateSuffix = duplicateIndex > 0 ? `_${duplicateIndex + 1}` : "";
  return `${prefix}_${vehicleNumber.toUpperCase().replace(/\s+/g, "")}_FASTag_Report_${formatReportDate(date)}${duplicateSuffix}`;
}

export function formatReportDate(date) {
  const day = date.getDate();
  const suffix = day % 100 >= 11 && day % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[day % 10] ?? "th");
  return `${day}${suffix} ${monthNames[date.getMonth()]}${String(date.getFullYear()).slice(-2)}`;
}
