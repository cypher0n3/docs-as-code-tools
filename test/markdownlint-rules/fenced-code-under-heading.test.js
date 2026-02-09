"use strict";

/**
 * Unit tests for fenced-code-under-heading: fenced code blocks (e.g. go) must have H2–H6 above; at most one per heading.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert");
const rule = require("../../markdownlint-rules/fenced-code-under-heading.js");
const { runRule } = require("./run-rule.js");

describe("fenced-code-under-heading", () => {
  it("reports no errors when no configured language blocks", () => {
    const lines = ["# Doc", "## Section", "```text", "content", "```"];
    const config = { "fenced-code-under-heading": { languages: ["go"] } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 0);
  });

  it("reports no errors when go block is under H2", () => {
    const lines = ["# Doc", "## Code", "```go", "package main", "```"];
    const config = { "fenced-code-under-heading": { languages: ["go"] } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 0);
  });

  it("reports error when go block has no preceding H2–H6", () => {
    const lines = ["# Doc", "Intro.", "```go", "package main", "```"];
    const config = { "fenced-code-under-heading": { languages: ["go"] } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 3);
    assert.ok(errors[0].detail.includes("must have an H2"));
  });

  it("reports error when two go blocks under same heading and maxBlocksPerHeading is 1", () => {
    const lines = [
      "# Doc",
      "## Section",
      "```go",
      "a",
      "```",
      "More text.",
      "```go",
      "b",
      "```",
    ];
    const config = { "fenced-code-under-heading": { languages: ["go"], maxBlocksPerHeading: 1 } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 7);
    assert.ok(errors[0].detail.includes("At most 1"));
  });

  it("reports no error when maxBlocksPerHeading is 2 and two blocks under one heading", () => {
    const lines = [
      "# Doc",
      "## Section",
      "```go",
      "a",
      "```",
      "```go",
      "b",
      "```",
    ];
    const config = { "fenced-code-under-heading": { languages: ["go"], maxBlocksPerHeading: 2 } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 0);
  });

  it("requireHeading: false does not report block with no heading", () => {
    const lines = ["# Doc", "```go", "x", "```"];
    const config = { "fenced-code-under-heading": { languages: ["go"], requireHeading: false } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 0);
  });

  it("H3 counts as valid heading above block", () => {
    const lines = ["# Doc", "## A", "### B", "```go", "x", "```"];
    const config = { "fenced-code-under-heading": { languages: ["go"] } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 0);
  });

  it("excludePaths skips file", () => {
    const lines = ["# Doc", "```go", "x", "```"];
    const config = { "fenced-code-under-heading": { languages: ["go"], excludePaths: ["**/skip.md"] } };
    const errors = runRule(rule, lines, config, "path/skip.md");
    assert.strictEqual(errors.length, 0);
  });

  it("does nothing when languages is empty", () => {
    const lines = ["# Doc", "```go", "x", "```"];
    const config = { "fenced-code-under-heading": { languages: [] } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 0);
  });

  it("language matching is case-insensitive", () => {
    const lines = ["# Doc", "## Code", "```GO", "x", "```"];
    const config = { "fenced-code-under-heading": { languages: ["go"] } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 0);
  });

  it("runs when includePaths is not an array (treated as empty)", () => {
    const lines = ["# Doc", "```go", "x", "```"];
    const config = { "fenced-code-under-heading": { languages: ["go"], includePaths: "**/*.md" } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 1);
  });

  it("runs when excludePaths is not an array (treated as empty)", () => {
    const lines = ["# Doc", "```go", "x", "```"];
    const config = { "fenced-code-under-heading": { languages: ["go"], excludePaths: "skip.md" } };
    const errors = runRule(rule, lines, config, "test.md");
    assert.strictEqual(errors.length, 1);
  });

  it("uses closest heading when multiple H2s appear before block", () => {
    const lines = ["# Doc", "## A", "## B", "```go", "x", "```"];
    const config = { "fenced-code-under-heading": { languages: ["go"] } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 0);
  });

  it("exclusive: true allows single go block under heading", () => {
    const lines = ["# Doc", "## Code", "```go", "x", "```"];
    const config = { "fenced-code-under-heading": { languages: ["go"], exclusive: true } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 0);
  });

  it("exclusive: true reports when two blocks (any language) under same heading", () => {
    const lines = [
      "# Doc",
      "## Section",
      "```go",
      "a",
      "```",
      "```bash",
      "echo x",
      "```",
    ];
    const config = { "fenced-code-under-heading": { languages: ["go"], exclusive: true } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 6);
    assert.ok(errors[0].detail.includes("Only one fenced code block allowed"));
  });

  it("exclusive: true reports when single block is not in configured languages", () => {
    const lines = ["# Doc", "## Section", "```bash", "x", "```"];
    const config = { "fenced-code-under-heading": { languages: ["go"], exclusive: true } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 3);
    assert.ok(errors[0].detail.includes("must be one of the configured languages"));
    assert.ok(errors[0].detail.includes("go"));
    assert.ok(errors[0].detail.includes("bash"));
  });

  it("exclusive: true reports when single block has no language (displays no language)", () => {
    const lines = ["# Doc", "## Section", "```", "plain", "```"];
    const config = { "fenced-code-under-heading": { languages: ["go"], exclusive: true } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 3);
    assert.ok(errors[0].detail.includes("(no language)"));
  });

  it("tilde-fenced block (~~~) is detected under heading", () => {
    const lines = ["# Doc", "## Code", "~~~go", "package main", "~~~"];
    const config = { "fenced-code-under-heading": { languages: ["go"] } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 0);
  });

  it("exclusive with tilde-fenced block uses findAllBlocks close path", () => {
    const lines = ["# Doc", "## Code", "~~~go", "x", "~~~"];
    const config = { "fenced-code-under-heading": { languages: ["go"], exclusive: true } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 0);
  });

  it("uses default minHeadingLevel when not a number", () => {
    const lines = ["# Doc", "## Section", "```go", "x", "```"];
    const config = { "fenced-code-under-heading": { languages: ["go"], minHeadingLevel: "2" } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 0);
  });

  it("uses default maxHeadingLevel when not a number", () => {
    const lines = ["# Doc", "## Section", "```go", "x", "```"];
    const config = { "fenced-code-under-heading": { languages: ["go"], maxHeadingLevel: "6" } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 0);
  });

  it("nested fences: inner ``` does not close outer ````` block (exclusive passes)", () => {
    const lines = [
      "# Doc",
      "## Nested Code Blocks Check",
      "````markdown",
      "<a id=\"x\"></a>",
      "",
      "```go",
      "func ReadFile()",
      "```",
      "````",
    ];
    const config = { "fenced-code-under-heading": { languages: ["go", "markdown"], exclusive: true } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 0);
  });
});
