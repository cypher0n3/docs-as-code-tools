"use strict";

/**
 * Unit tests for no-tables: disallow GFM tables; when convert-to is "list",
 * suggest converting each table to a list format.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert");
const rule = require("../../markdownlint-rules/no-tables.js");
const { runRule } = require("./run-rule.js");

const SIMPLE_TABLE = [
  "| heading 1 | heading 2 | heading 3 |",
  "| --- | --- | --- |",
  "| h1c1 content | h2c1 content | h3c1 content |",
  "| h1c2 content | h2c2 content | h3c2 content |",
];

describe("no-tables", () => {
  it("reports no errors for file with no tables", () => {
    const lines = ["# Heading", "Some paragraph.", "- list item", ""];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports error for a simple table with default config (convert-to none)", () => {
    const lines = ["## Table", "", ...SIMPLE_TABLE];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 3);
    assert.strictEqual(errors[0].detail, "Tables are not allowed.");
    assert.ok(!errors[0].detail.includes("Suggested list format"), "detail must not include long suggestion when convert-to is none");
  });

  it("reports errors with suggested list and fixInfo when convert-to is list", () => {
    const lines = ["## Table", "", ...SIMPLE_TABLE];
    const config = { "no-tables": { "convert-to": "list" } };
    const errors = runRule(rule, lines, config);
    // One error per table line (4 lines) so --fix can replace first and delete rest
    assert.strictEqual(errors.length, 4);
    assert.strictEqual(errors[0].lineNumber, 3);
    assert.ok(errors[0].detail.includes("Tables are not allowed"));
    assert.ok(errors[0].detail.includes("Suggested list format"));
    assert.ok(errors[0].detail.includes("**heading 1:**"));
    assert.ok(errors[0].detail.includes("heading 2:"));
    assert.ok(errors[0].detail.includes("heading 3:"));
    assert.ok(errors[0].fixInfo, "first error must have fixInfo to replace with list");
    assert.strictEqual(errors[0].fixInfo.editColumn, 1);
    assert.strictEqual(errors[0].fixInfo.deleteCount, lines[2].length);
    assert.ok(errors[0].fixInfo.insertText.includes("- **heading 1:**"));
    for (let i = 1; i < 4; i++) {
      assert.strictEqual(errors[i].fixInfo?.deleteCount, -1, `error ${i} should delete line`);
    }
  });

  it("does not report table inside fenced code block", () => {
    const lines = [
      "## Code",
      "```",
      "| a | b |",
      "| --- | --- |",
      "| 1 | 2 |",
      "```",
    ];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports no error when suppress comment on previous line", () => {
    const lines = ["## Table", "<!-- no-tables allow -->", ...SIMPLE_TABLE];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports no error when suppress comment at end of table first line", () => {
    const lines = ["## Table", "| heading 1 | heading 2 | <!-- no-tables allow -->", "| --- | --- |", "| a | b |"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("skips rule when file path matches excludePathPatterns", () => {
    const lines = ["## Table", "", ...SIMPLE_TABLE];
    const config = { "no-tables": { excludePathPatterns: ["**/README.md", "docs/**"] } };
    const errorsMatch = runRule(rule, lines, config, "project/README.md");
    assert.strictEqual(errorsMatch.length, 0);
    const errorsNoMatch = runRule(rule, lines, config, "project/src/guide.md");
    assert.strictEqual(errorsNoMatch.length, 1);
  });

  it("reports two errors for two tables in one file", () => {
    const lines = [
      "## First",
      "| a | b |",
      "| --- | --- |",
      "| 1 | 2 |",
      "",
      "## Second",
      "| x | y |",
      "| --- | --- |",
      "| 3 | 4 |",
    ];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 2);
    assert.strictEqual(errors[0].lineNumber, 2);
    assert.strictEqual(errors[1].lineNumber, 7);
  });

  it("treats invalid convert-to value as none (short message only)", () => {
    const lines = ["## Table", "", ...SIMPLE_TABLE];
    const config = { "no-tables": { "convert-to": "paragraph" } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].detail, "Tables are not allowed.");
    assert.ok(!errors[0].detail.includes("Suggested list format"));
  });

  it("treats missing convert-to as none", () => {
    const lines = ["## Table", "", ...SIMPLE_TABLE];
    const config = { "no-tables": {} };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].detail, "Tables are not allowed.");
  });

  it("accepts separator with alignment (e.g. :---)", () => {
    const lines = ["| a | b |", "| :--- | :---: |", "| 1 | 2 |"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 1);
  });

  it("sets context to first line of table", () => {
    const lines = ["## Section", "", ...SIMPLE_TABLE];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].context, "| heading 1 | heading 2 | heading 3 |");
  });

  it("reports no error for pipe lines without separator (not a GFM table)", () => {
    const lines = ["| a | b |", "| c | d |"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0, "lines with | but no separator row are not a table");
  });

  it("runs with config undefined (uses default convert-to none)", () => {
    const lines = ["## T", "", ...SIMPLE_TABLE];
    const errors = runRule(rule, lines, undefined);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].detail, "Tables are not allowed.");
  });

  it("when convert-to list skips delete-error for table line that has suppress comment", () => {
    const lines = [
      "## T",
      "| a | b |",
      "| --- | --- |",
      "| 1 | 2 | <!-- no-tables allow -->",
    ];
    const config = { "no-tables": { "convert-to": "list" } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 2, "replace first line + delete separator; body line suppressed");
    assert.strictEqual(errors[0].lineNumber, 2);
    assert.strictEqual(errors[0].fixInfo.deleteCount, lines[1].length);
    assert.strictEqual(errors[1].lineNumber, 3);
    assert.strictEqual(errors[1].fixInfo.deleteCount, -1);
  });

});
