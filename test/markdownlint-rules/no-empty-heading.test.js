"use strict";

/**
 * Unit tests for no-empty-heading: H2+ headings must have at least one
 * line of content before the next same-or-higher-level heading.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert");
const rule = require("../../markdownlint-rules/no-empty-heading.js");
const { runRule } = require("./run-rule.js");

describe("no-empty-heading", () => {
  it("reports no errors when no H2+ headings", () => {
    const lines = ["# Title", "Content only."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports no errors when H2 has content", () => {
    const lines = ["# Doc", "## Section", "Some prose here.", "## Next", "More."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports no errors when H3 has content", () => {
    const lines = ["# Doc", "## A", "Content.", "## B", "### B1", "Content."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports error for H2 with no content before next H2", () => {
    const lines = ["# Doc", "## Empty", "", "## Next", "Content."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 2);
    assert.ok(errors[0].detail.includes("at least one line of content"));
  });

  it("reports error for H2 with only blank lines before next heading", () => {
    const lines = ["# Doc", "## Empty", "", "", "## Next", "Content."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 2);
  });

  it("reports error for H2 at end of file with no content", () => {
    const lines = ["# Doc", "## A", "Content.", "## Empty"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 4);
  });

  it("reports error for H3 with no content before next H3", () => {
    const lines = ["# Doc", "## Section", "", "### Empty", "", "### Next", "Content."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 4);
  });

  it("reports error for H2 with only HTML comment as content", () => {
    const lines = ["# Doc", "## Empty", "<!-- comment -->", "## Next", "Content."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 2);
  });

  it("reports no error when section has only the suppress comment (no-empty-heading allow)", () => {
    const lines = ["# Doc", "## Empty", "<!-- no-empty-heading allow -->", "## Next", "Content."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports no error when suppress comment has optional whitespace", () => {
    const lines = ["# Doc", "## Empty", "  <!--   no-empty-heading   allow   -->  ", "## Next", "Content."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports no error when section has only cleared-form suppress comment (markdownlint clears HTML comment text)", () => {
    const lines = ["# Doc", "## Empty", "<!-- ................ ..... -->", "## Next", "Content."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports no error when section has other HTML comments plus suppress comment on its own line", () => {
    const lines = [
      "# Doc",
      "## Empty",
      "<!-- placeholder -->",
      "<!-- no-empty-heading allow -->",
      "## Next",
      "Content.",
    ];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports error when suppress comment is on same line as another comment (must be on its own line)", () => {
    const lines = ["# Doc", "## Empty", "<!-- x --> <!-- no-empty-heading allow -->", "## Next", "Content."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 2);
  });

  it("reports error when comment is similar but not the exact suppress format", () => {
    const badComments = [
      "<!-- no-empty-heading: allow -->", // colon not allowed
      "<!-- no-empty-headingallow -->",   // missing space before allow
      "<!-- no-empty-heading -->",         // missing allow
    ];
    for (const comment of badComments) {
      const lines = ["# Doc", "## Empty", comment, "## Next", "Content."];
      const errors = runRule(rule, lines);
      assert.strictEqual(errors.length, 1, `Expected error for comment: ${comment}`);
    }
  });

  it("reports multiple errors for multiple empty H2+ headings", () => {
    const lines = [
      "# Doc",
      "## A",
      "Content.",
      "## Empty1",
      "",
      "## Empty2",
      "",
      "## B",
      "Content.",
    ];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 2);
    const lineNumbers = errors.map((e) => e.lineNumber).sort((a, b) => a - b);
    assert.deepStrictEqual(lineNumbers, [4, 6]);
  });

  it("does not report H1 (level 1)", () => {
    const lines = ["# Title", "## Only section", "Content."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("skips when file path matches excludePathPatterns", () => {
    const lines = ["# Doc", "## Empty", "", "## Next", "Content."];
    const config = { excludePathPatterns: ["**/foo.md"] };
    const errors = runRule(rule, lines, config, "md_test_files/foo.md");
    assert.strictEqual(errors.length, 0);
  });

  it("runs when file path does not match excludePathPatterns", () => {
    const lines = ["# Doc", "## Empty", "", "## Next", "Content."];
    const config = { excludePathPatterns: ["**/other.md"] };
    const errors = runRule(rule, lines, config, "md_test_files/foo.md");
    assert.strictEqual(errors.length, 1);
  });

  it("skips when file path matches excludePathPatterns **/*_index.md", () => {
    const lines = ["# Index", "## Empty", "", "## Next", "Content."];
    const config = { excludePathPatterns: ["**/*_index.md"] };
    const errors = runRule(rule, lines, config, "md_test_files/positive_general_index.md");
    assert.strictEqual(errors.length, 0);
  });
});
