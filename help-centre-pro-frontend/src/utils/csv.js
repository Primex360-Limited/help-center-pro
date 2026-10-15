/**
 * Tiny CSV helper shared by the workspace screens.
 *
 * `columns` is `[{ label, value }]` where `value` is either a row key or a
 * function returning the cell value, e.g.
 * `{ label: "Name", value: (row) => row.fullName }`.
 */

function escapeCell(value) {
  if (value === null || value === undefined) return "";

  const text = String(value);

  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function cellValue(row, column) {
  if (typeof column.value === "function") return column.value(row);
  return row[column.value];
}

export function toCsv(columns, rows) {
  const header = columns.map((column) => escapeCell(column.label)).join(",");
  const body = rows.map((row) =>
    columns.map((column) => escapeCell(cellValue(row, column))).join(",")
  );

  return [header, ...body].join("\r\n");
}

export function downloadCsv(filename, columns, rows) {
  // The BOM keeps Excel from mangling accented names.
  const blob = new Blob([`\uFEFF${toCsv(columns, rows)}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default downloadCsv;
