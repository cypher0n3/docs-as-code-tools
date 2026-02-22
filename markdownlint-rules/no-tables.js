"use strict";

const { isRuleSuppressedByComment, pathMatchesAny } = require("./utils.js");

/** Each cell of a GFM separator row contains only spaces, dashes, and colons. */
const RE_SEPARATOR_CELL = /^[\s\-:]*$/;

/**
 * Check if line is a table separator (| --- | --- | or |:---|:---:|---:|).
 * @param {string} line
 * @returns {boolean}
 */
function isTableSeparator(line) {
  if (!line || !line.includes("|") || !line.includes("-")) return false;
  const cells = parseRow(line);
  if (cells.length === 0) return false;
  return cells.every((cell) => RE_SEPARATOR_CELL.test(cell));
}

/**
 * Parse a table row into cells (split by |, trim, drop leading/trailing empty from outer pipes).
 * @param {string} line
 * @returns {string[]}
 */
function parseRow(line) {
  const parts = line.split("|").map((s) => s.trim());
  if (parts.length > 0 && parts[0] === "") parts.shift();
  if (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();
  return parts;
}

/**
 * Find table blocks (runs of | lines that include a separator) outside fenced code.
 * @param {string[]} lines
 * @returns {{ startLine: number, endLine: number, headerRow: string[], bodyRows: string[][] }[]}
 */
function findTables(lines) {
  const tables = [];
  let inFence = false;
  let fenceMarker = null;
  let runStart = null;
  let runLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;
    const trimmed = line.trim();

    const fenceMatch = trimmed.match(/^(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0] === "`" ? "```" : "~~~";
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (fenceMarker === marker) {
        inFence = false;
        fenceMarker = null;
      }
      flushRun();
      continue;
    }
    if (inFence) {
      flushRun();
      continue;
    }

    if (!line.includes("|")) {
      flushRun();
      continue;
    }

    if (runStart === null) runStart = lineNumber;
    runLines.push(line);
  }
  flushRun();

  function flushRun() {
    if (runLines.length === 0) {
      runStart = null;
      runLines = [];
      return;
    }
    const separatorIndex = runLines.findIndex((l) => isTableSeparator(l));
    if (separatorIndex < 0) {
      runStart = null;
      runLines = [];
      return;
    }
    const headerRow = parseRow(runLines[0]);
    const bodyRows = runLines.slice(separatorIndex + 1).map(parseRow);
    tables.push({
      startLine: runStart,
      endLine: runStart + runLines.length - 1,
      headerRow,
      bodyRows,
    });
    runStart = null;
    runLines = [];
  }

  return tables;
}

/**
 * Build list-format suggestion from parsed table (first column bold header, rest indented "  - header: cell").
 * @param {string[]} headerRow
 * @param {string[][]} bodyRows
 * @returns {string}
 */
function tableToListSuggestion(headerRow, bodyRows) {
  if (headerRow.length === 0) return "";
  const h0 = headerRow[0];
  const restHeaders = headerRow.slice(1);
  const lines = [];
  for (const row of bodyRows) {
    const c0 = row[0] ?? "";
    lines.push(`- **${h0}:** ${c0}`);
    for (let j = 0; j < restHeaders.length; j++) {
      const label = restHeaders[j].toLowerCase();
      /* c8 ignore next 1 -- empty cell when row has fewer columns than header */
      const cell = row[j + 1] ?? "";
      lines.push(`  - ${label}: ${cell}`);
    }
  }
  return lines.join("\n");
}

const SHORT_MESSAGE = "Tables are not allowed.";

/**
 * Report one table violation (no fix).
 * @param {object} opts
 * @param {number} opts.lineNumber
 * @param {string} opts.contextLine
 * @param {string} opts.convertTo
 * @param {string} [opts.suggestedList]
 * @param {string[]} opts.lines
 * @param {function(object): void} opts.onError
 */
function reportTableError(opts) {
  const { lineNumber, contextLine, convertTo, suggestedList, lines, onError } = opts;
  if (isRuleSuppressedByComment(lines, lineNumber, "no-tables")) return;
  /* c8 ignore next 3 -- convertTo "list" uses reportTableWithFix, not this path */
  const detail =
    convertTo === "list" && suggestedList
      ? `${SHORT_MESSAGE} Suggested list format:\n${suggestedList}`
      : SHORT_MESSAGE;
  onError({
    lineNumber,
    detail,
    context: contextLine,
  });
}

/**
 * Report table violation(s) with fixInfo when convertTo is "list": one error on first line (replace with list)
 * and one per remaining line (delete line) so --fix converts the table to a list.
 * @param {object} opts
 * @param {{ startLine: number, endLine: number, headerRow: string[], bodyRows: string[][] }} opts.table
 * @param {string[]} opts.lines
 * @param {function(object): void} opts.onError
 */
function reportTableWithFix(opts) {
  const { table, lines, onError } = opts;
  const suggestedList = tableToListSuggestion(table.headerRow, table.bodyRows);
  const firstLineIndex = table.startLine - 1;
  const firstLine = lines[firstLineIndex];
  /* c8 ignore next 1 -- defensive: firstLine missing (sparse array) */
  if (firstLine == null) return;
  if (!isRuleSuppressedByComment(lines, table.startLine, "no-tables")) {
    onError({
      lineNumber: table.startLine,
      detail: `${SHORT_MESSAGE} Suggested list format:\n${suggestedList}`,
      context: firstLine,
      fixInfo: {
        editColumn: 1,
        deleteCount: firstLine.length,
        insertText: suggestedList,
      },
    });
  }
  for (let lineNum = table.startLine + 1; lineNum <= table.endLine; lineNum++) {
    if (isRuleSuppressedByComment(lines, lineNum, "no-tables")) continue;
    const lineContent = lines[lineNum - 1];
    onError({
      lineNumber: lineNum,
      detail: SHORT_MESSAGE,
      /* c8 ignore next 1 -- defensive: sparse array */
      context: lineContent ?? "",
      fixInfo: { editColumn: 1, deleteCount: -1 },
    });
  }
}

/**
 * Normalize rule config: convert-to ("list" or "none") and excludePathPatterns.
 * @param {object} ruleConfig
 * @returns {{ convertTo: "list"|"none", excludePathPatterns: string[]|undefined }}
 */
function getConfig(ruleConfig) {
  const convertTo =
    typeof ruleConfig["convert-to"] === "string" && ruleConfig["convert-to"].toLowerCase() === "list"
      ? "list"
      : "none";
  return { convertTo, excludePathPatterns: ruleConfig.excludePathPatterns };
}

/**
 * Report all table violations for the given tables.
 * When convertTo is "list", reports one error per table line with fixInfo so --fix converts table to list.
 * @param {string[]} lines
 * @param {{ startLine: number, endLine: number, headerRow: string[], bodyRows: string[][] }[]} tables
 * @param {"list"|"none"} convertTo
 * @param {function(object): void} onError
 */
function reportTables(lines, tables, convertTo, onError) {
  for (const table of tables) {
    if (convertTo === "list") {
      reportTableWithFix({ table, lines, onError });
    } else {
      const suggestedList = "";
      reportTableError({
        lineNumber: table.startLine,
        contextLine: lines[table.startLine - 1],
        convertTo,
        suggestedList,
        lines,
        onError,
      });
    }
  }
}

/**
 * markdownlint rule: disallow GFM tables. When convert-to is "list", suggest converting each table to a list.
 *
 * @param {object} params - markdownlint params (lines, name, config)
 * @param {function(object): void} onError - Callback to report an error
 */
function ruleFunction(params, onError) {
  const lines = params.lines;
  const filePath = params.name || "";
  /* c8 ignore next 1 -- config fallback when params.config undefined */
  const ruleConfig = params.config?.["no-tables"] ?? params.config ?? {};
  const { convertTo, excludePathPatterns } = getConfig(ruleConfig);
  if (Array.isArray(excludePathPatterns) && excludePathPatterns.length > 0 && pathMatchesAny(filePath, excludePathPatterns)) {
    return;
  }
  const tables = findTables(lines);
  reportTables(lines, tables, convertTo, onError);
}

module.exports = {
  names: ["no-tables"],
  description: "Disallow tables; optional list suggestion and fix via convert-to",
  tags: ["content"],
  function: ruleFunction,
};
