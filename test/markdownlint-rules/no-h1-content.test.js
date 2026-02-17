"use strict";

/**
 * Unit tests for no-h1-content: under the first h1, only TOC (blank lines,
 * list-of-links, HTML comments) is allowed; any other content is reported.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert");
const rule = require("../../markdownlint-rules/no-h1-content.js");
const { runRule } = require("./run-rule.js");

describe("no-h1-content", () => {
  it("reports no errors when no h1", () => {
    const lines = ["## Section", "Some prose here."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports no errors for h1 followed only by TOC (list-of-links)", () => {
    const lines = [
      "# Title",
      "",
      "- [One](#one)",
      "- [Two](#two)",
      "",
      "## One",
      "Content.",
    ];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports no errors for ordered TOC list", () => {
    const lines = ["# Doc", "1. [A](#a)", "2. [B](#b)", "## A"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports no errors for HTML comments under h1", () => {
    const lines = ["# Title", "<!-- TOC -->", "- [X](#x)", "<!-- /TOC -->", "## X"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports no errors for multi-line HTML comment under h1", () => {
    const lines = ["# Title", "<!--", "  Expect: some note", "-->", "", "## Section"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports no errors for badge lines under h1", () => {
    const lines = [
      "# Repo",
      "[![CI](https://example.com/ci.svg)](https://example.com)",
      "[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)",
      "## Section",
    ];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports no errors for reference-style badge lines under h1", () => {
    const lines = [
      "# Repo",
      "[![Docs Check][badge-docs-check]][workflow-docs-check]",
      "[![Go CI][badge-go-ci]][workflow-go-ci]",
      "[![License][badge-license]][license-file]",
      "",
      "## Section",
    ];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports no errors for multiple reference-style badges on one line under h1", () => {
    const lines = [
      "# Repo",
      "[![Docs Check][badge-docs-check]][workflow-docs-check] [![Go CI][badge-go-ci]][workflow-go-ci] [![License][badge-license]][license-file]",
      "## Section",
    ];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports no errors for mixed inline and reference-style badges on one line under h1", () => {
    const lines = [
      "# Repo",
      "[![CI](https://example.com/ci.svg)](https://example.com) [![License][badge-license]][license-file]",
      "## Section",
    ];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports no errors for reference-style badge line with leading and trailing spaces under h1", () => {
    const lines = [
      "# Repo",
      "  [![Docs Check][badge-docs-check]][workflow-docs-check]  ",
      "## Section",
    ];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports no errors for empty content under h1", () => {
    const lines = ["# Title", "", "## First"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports error for prose under h1", () => {
    const lines = ["# Title", "This is not allowed.", "## Section"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 2);
    assert.ok(errors[0].detail.includes("table of contents"));
  });

  it("reports no error when suppress comment on previous line (line-level override)", () => {
    const lines = ["# Title", "<!-- no-h1-content allow -->", "This is not allowed.", "## Section"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports error for code block under h1", () => {
    const lines = ["# Title", "```", "code", "```", "## Next"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 3);
    assert.strictEqual(errors[0].lineNumber, 2);
  });

  it("reports only lines in h1 block (before next heading)", () => {
    const lines = [
      "# Title",
      "Not allowed.",
      "## Section",
      "This is under h2, so allowed by this rule.",
    ];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 2);
  });

  it("skips when file path matches excludePathPatterns", () => {
    const lines = ["# Title", "Prose under h1."];
    const config = { excludePathPatterns: ["**/foo.md"] };
    const errors = runRule(rule, lines, config, "md_test_files/foo.md");
    assert.strictEqual(errors.length, 0);
  });

  it("runs when file path does not match excludePathPatterns", () => {
    const lines = ["# Title", "Prose under h1."];
    const config = { excludePathPatterns: ["**/other.md"] };
    const errors = runRule(rule, lines, config, "md_test_files/foo.md");
    assert.strictEqual(errors.length, 1);
  });

  describe("edge cases", () => {
    it("TOC link with space before hash [Text]( #anchor ) is not valid TOC item", () => {
      const lines = ["# Doc", "- [One]( #one)", "## One"];
      const errors = runRule(rule, lines);
      assert.ok(errors.length >= 1, "line with space in link may not match RE_TOC_LIST_ITEM");
    });

    it("H1 as last line (endLine equals lines.length) has no content under it", () => {
      const lines = ["## First", "Content.", "# Only H1"];
      const errors = runRule(rule, lines);
      assert.strictEqual(errors.length, 0, "no content under H1 at end");
    });

    it("fenced code block opening line under H1 is reported as disallowed content", () => {
      const lines = ["# Title", "```", "code", "```", "## Next"];
      const errors = runRule(rule, lines);
      assert.ok(errors.length >= 1);
      assert.strictEqual(errors[0].lineNumber, 2);
    });
  });
});
