"use strict";

/**
 * Unit tests for no-empty-heading: H2+ headings must have at least one
 * line of content directly under the heading (before any subheading).
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

  it("reports no errors when H3 has content (direct content under H2 and under H3)", () => {
    const lines = ["# Doc", "## A", "Content.", "## B", "Intro under B.", "### B1", "Content."];
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
    const lines = ["# Doc", "## Section", "Intro.", "### Empty", "", "### Next", "Content."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 4);
  });

  it("reports error for H2 with only subheading and content under subheading (no direct content)", () => {
    const lines = ["# Doc", "## Empty", "### Sub", "Content under sub.", "## Next", "More."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 2);
  });

  it("reports error for H3 with only H4 and content under H4 (no direct content under H3)", () => {
    const lines = ["# Doc", "## Section", "Intro.", "### Empty H3", "#### H4", "Content.", "### Next", "More."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 4);
  });

  it("reports no error for H4 with direct content before next heading", () => {
    const lines = ["# Doc", "## A", "Under A.", "### B", "Under B.", "#### C", "Direct under C.", "### D", "Content."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports no error when suppress comment is direct content before subheading", () => {
    const lines = ["# Doc", "## Section", "<!-- no-empty-heading allow -->", "### Sub", "Content.", "## Next", "More."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports error for H2 with no direct content when H3 below has content", () => {
    const lines = ["# Doc", "## Empty", "### Has content", "Text.", "## Next", "More."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 2);
  });

  it("reports error for H2 with only HTML comment as content", () => {
    const lines = ["# Doc", "## Empty", "<!-- comment -->", "## Next", "Content."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 2);
  });

  it("reports error for H2 with only multi-line HTML comment (lines do not count as content)", () => {
    const lines = ["# Doc", "## Empty", "<!--", "  multi-line comment", "-->", "## Next", "Content."];
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

  it("reports no error when suppress comment on line before empty heading (line-level override)", () => {
    const lines = ["# Doc", "<!-- no-empty-heading allow -->", "## Empty", "## Next", "Content."];
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

  it("reports no error when empty heading title is in allowList", () => {
    const lines = ["# Doc", "## Overview", "", "## Next", "Content."];
    const config = { "no-empty-heading": { allowList: ["Overview"] } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 0);
  });

  it("reports no error when empty heading title is in allowList (case-insensitive)", () => {
    const lines = ["# Doc", "## SUMMARY", "", "## Next", "Content."];
    const config = { "no-empty-heading": { allowList: ["Summary"] } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 0);
  });

  it("reports no error when numbered heading title matches allowList after strip", () => {
    const lines = ["# Doc", "## 1. Overview", "", "## Next", "Content."];
    const config = { "no-empty-heading": { allowList: ["Overview"] } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 0);
  });

  it("reports error when empty heading title is not in allowList", () => {
    const lines = ["# Doc", "## Other", "", "## Next", "Content."];
    const config = { "no-empty-heading": { allowList: ["Overview", "Summary"] } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 2);
  });

  it("stripNumberingForAllowList: false requires full title in allowList", () => {
    const lines = ["# Doc", "## 1. Overview", "", "## Next", "Content."];
    const config = { "no-empty-heading": { allowList: ["1. Overview"], stripNumberingForAllowList: false } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 0);
  });

  it("skips when file path matches excludePathPatterns **/*_index.md", () => {
    const lines = ["# Index", "## Empty", "", "## Next", "Content."];
    const config = { excludePathPatterns: ["**/*_index.md"] };
    const errors = runRule(rule, lines, config, "md_test_files/positive_general_index.md");
    assert.strictEqual(errors.length, 0);
  });

  it("respects minimumContentLines: 2 (reports when only 1 line)", () => {
    const lines = ["# Doc", "## Section", "One line only.", "## Next", "Content.", "More."];
    const config = { minimumContentLines: 2 };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 2);
    assert.ok(errors[0].detail.includes("at least 2 lines of content"));
  });

  it("respects minimumContentLines: 2 (no error when 2+ lines)", () => {
    const lines = ["# Doc", "## Section", "First.", "Second.", "## Next", "Content.", "More."];
    const config = { minimumContentLines: 2 };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 0);
  });

  it("countHTMLCommentsAsContent: true treats HTML comment as content", () => {
    const lines = ["# Doc", "## Section", "<!-- comment -->", "## Next", "Content."];
    const config = { countHTMLCommentsAsContent: true };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 0);
  });

  it("countBlankLinesAsContent: true treats blank line as content", () => {
    const lines = ["# Doc", "## Section", "", "## Next", "Content."];
    const config = { countBlankLinesAsContent: true };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 0);
  });

  it("minimumContentLines with countBlankLinesAsContent counts blanks", () => {
    const lines = ["# Doc", "## Section", "One.", "", "## Next", "Content.", "More."];
    const config = { minimumContentLines: 2, countBlankLinesAsContent: true };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 0);
  });

  it("uses default minimumContentLines when config is invalid", () => {
    const lines = ["# Doc", "## Empty", "", "## Next", "Content."];
    const errors = runRule(rule, lines, { minimumContentLines: 0 });
    assert.strictEqual(errors.length, 1);
    const errors2 = runRule(rule, lines, { minimumContentLines: "two" });
    assert.strictEqual(errors2.length, 1);
  });

  it("countCodeBlockLinesAsContent: true (default) treats code block as content", () => {
    const lines = ["# Doc", "## Section", "```", "const x = 1;", "```", "## Next", "Content."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("countCodeBlockLinesAsContent: false does not count lines inside code block", () => {
    const lines = ["# Doc", "## Section", "```", "const x = 1;", "```", "## Next", "Content."];
    const config = { countCodeBlockLinesAsContent: false };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 2);
  });

  it("countHtmlLinesAsContent: true treats HTML tag line as content", () => {
    const lines = ["# Doc", "## Section", "<br>", "## Next", "Content."];
    const config = { countHtmlLinesAsContent: true };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 0);
  });

  it("countHtmlLinesAsContent: false (default) does not count HTML tag line", () => {
    const lines = ["# Doc", "## Section", "<br>", "## Next", "Content."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 2);
  });

  it("countCodeBlockLinesAsContent: false ignores ~~~ fenced block", () => {
    const lines = ["# Doc", "## Section", "~~~", "text", "~~~", "## Next", "Content."];
    const config = { countCodeBlockLinesAsContent: false };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 2);
  });

  it("error detail mentions at least N lines when minimumContentLines > 1", () => {
    const lines = ["# Doc", "## Section", "One.", "## Next", "A.", "B."];
    const config = { minimumContentLines: 2 };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].detail.includes("at least 2 lines of content"));
  });

  it("error detail reflects countHtmlLinesAsContent when true", () => {
    const lines = ["# Doc", "## Section", "<br>", "## Next", "Content."];
    const config = { countHtmlLinesAsContent: true };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 0);
  });

  it("combined options: minimumContentLines 2 with prose and blank", () => {
    const lines = ["# Doc", "## Section", "Line one.", "", "## Next", "A.", "B."];
    const config = { minimumContentLines: 2, countBlankLinesAsContent: true };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 0);
  });

  describe("edge cases", () => {
    it("unclosed multi-line HTML comment at end of section does not count as content", () => {
      const lines = ["# Doc", "## Empty", "<!--", "  unclosed", "## Next", "Content."];
      const errors = runRule(rule, lines);
      assert.strictEqual(errors.length, 1);
      assert.strictEqual(errors[0].lineNumber, 2);
    });

    it("minimumContentLines 2 with countBlankLinesAsContent and only one blank reports error", () => {
      const lines = ["# Doc", "## Section", "", "## Next", "Content."];
      const config = { minimumContentLines: 2, countBlankLinesAsContent: true };
      const errors = runRule(rule, lines, config);
      assert.ok(errors.length >= 1, "section(s) with only 1 content line when 2 required");
      assert.ok(errors.some((e) => e.detail.includes("at least 2 lines")));
    });

    it("section with only self-closing HTML tag when countHtmlLinesAsContent false reports empty", () => {
      const lines = ["# Doc", "## Section", "<br />", "## Next", "Content."];
      const errors = runRule(rule, lines);
      assert.strictEqual(errors.length, 1);
      assert.strictEqual(errors[0].lineNumber, 2);
    });
  });
});
