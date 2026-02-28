"use strict";

/**
 * Unit tests for utils.js helpers used by custom rules (e.g. isRuleSuppressedByComment).
 */

const { describe, it } = require("node:test");
const assert = require("node:assert");
const { isRuleSuppressedByComment } = require("../../markdownlint-rules/utils.js");

describe("utils", () => {
  describe("isRuleSuppressedByComment", () => {
    it("returns true when previous line is solely the suppress comment", () => {
      const lines = ["<!-- no-empty-heading allow -->", "## Empty", "## Next"];
      assert.strictEqual(isRuleSuppressedByComment(lines, 2, "no-empty-heading"), true);
    });

    it("returns true when current line ends with the suppress comment", () => {
      const lines = ["## Empty section <!-- no-empty-heading allow -->", "## Next"];
      assert.strictEqual(isRuleSuppressedByComment(lines, 1, "no-empty-heading"), true);
    });

    it("returns true with optional whitespace in comment (previous line)", () => {
      const lines = ["  <!--   ascii-only   allow   -->  ", "Café"];
      assert.strictEqual(isRuleSuppressedByComment(lines, 2, "ascii-only"), true);
    });

    it("returns false when wrong rule name in comment (previous line)", () => {
      const lines = ["<!-- ascii-only allow -->", "## Single"];
      assert.strictEqual(isRuleSuppressedByComment(lines, 2, "heading-min-words"), false);
    });

    it("returns false when no comment present", () => {
      const lines = ["## Empty", "## Next"];
      assert.strictEqual(isRuleSuppressedByComment(lines, 1, "no-empty-heading"), false);
    });

    it("returns false when lineNumber is 1 and no comment on line 1", () => {
      const lines = ["## First heading"];
      assert.strictEqual(isRuleSuppressedByComment(lines, 1, "no-empty-heading"), false);
    });

    it("returns true when lineNumber is 1 and line 1 is only the comment", () => {
      const lines = ["<!-- document-length allow -->", "second line"];
      assert.strictEqual(isRuleSuppressedByComment(lines, 1, "document-length"), true);
    });

    it("returns false for invalid inputs (null lines, out of range)", () => {
      assert.strictEqual(isRuleSuppressedByComment(null, 1, "x"), false);
      assert.strictEqual(isRuleSuppressedByComment([], 1, "x"), false);
      assert.strictEqual(isRuleSuppressedByComment(["a"], 0, "x"), false);
      assert.strictEqual(isRuleSuppressedByComment(["a"], 2, "x"), false);
      assert.strictEqual(isRuleSuppressedByComment(["a"], 1, ""), false);
      assert.strictEqual(isRuleSuppressedByComment(["a"], 1, null), false);
    });

    it("returns false when current line is undefined (e.g. sparse array)", () => {
      const lines = Array(3);
      lines[0] = "first";
      lines[2] = "third";
      assert.strictEqual(isRuleSuppressedByComment(lines, 2, "x"), false);
    });

    it("returns true when line ends with markdownlint-cleared comment form (dots)", () => {
      const lines = ["Use arrow → here. <!-- .......... ..... -->"];
      assert.strictEqual(isRuleSuppressedByComment(lines, 1, "ascii-only"), true);
    });

    it("returns true when line is inside disable block (between disable and enable)", () => {
      const lines = [
        "<!-- no-empty-heading disable -->",
        "## 1. Empty Heading 1",
        "",
        "## 2. Empty Heading 2",
        "",
        "## 3. Empty Heading 3",
        "<!-- no-empty-heading enable -->",
        "",
        "## 4. Empty Heading 4",
      ];
      assert.strictEqual(isRuleSuppressedByComment(lines, 2, "no-empty-heading"), true);
      assert.strictEqual(isRuleSuppressedByComment(lines, 4, "no-empty-heading"), true);
      assert.strictEqual(isRuleSuppressedByComment(lines, 6, "no-empty-heading"), true);
      assert.strictEqual(isRuleSuppressedByComment(lines, 9, "no-empty-heading"), false);
    });

    it("returns false when enable turns rule back on (line after enable is not suppressed)", () => {
      const lines = [
        "<!-- no-empty-heading disable -->",
        "## Empty",
        "<!-- no-empty-heading enable -->",
        "## Empty Again",
      ];
      assert.strictEqual(isRuleSuppressedByComment(lines, 2, "no-empty-heading"), true);
      assert.strictEqual(isRuleSuppressedByComment(lines, 4, "no-empty-heading"), false);
    });

    it("returns true when disable has no matching enable (rest of file suppressed)", () => {
      const lines = [
        "## OK",
        "Content.",
        "<!-- no-empty-heading disable -->",
        "## Empty",
        "## Also Empty",
      ];
      assert.strictEqual(isRuleSuppressedByComment(lines, 1, "no-empty-heading"), false);
      assert.strictEqual(isRuleSuppressedByComment(lines, 4, "no-empty-heading"), true);
      assert.strictEqual(isRuleSuppressedByComment(lines, 5, "no-empty-heading"), true);
    });

    it("disable/enable: wrong rule name in comment does not affect state", () => {
      const lines = [
        "<!-- no-empty-heading disable -->",
        "## Empty",
        "<!-- other-rule enable -->",
        "## Still Empty",
      ];
      assert.strictEqual(isRuleSuppressedByComment(lines, 2, "no-empty-heading"), true);
      assert.strictEqual(isRuleSuppressedByComment(lines, 4, "no-empty-heading"), true);
    });

    it("disable/enable: allow optional whitespace in comment", () => {
      const lines = ["  <!--  no-empty-heading  disable  -->  ", "## Empty"];
      assert.strictEqual(isRuleSuppressedByComment(lines, 2, "no-empty-heading"), true);
    });

    it("disable only (no enable): ascii-only stays suppressed for rest of file", () => {
      const lines = [
        "ASCII line.",
        "<!-- ascii-only disable -->",
        "Use → here.",
        "And café here.",
      ];
      assert.strictEqual(isRuleSuppressedByComment(lines, 1, "ascii-only"), false);
      assert.strictEqual(isRuleSuppressedByComment(lines, 3, "ascii-only"), true);
      assert.strictEqual(isRuleSuppressedByComment(lines, 4, "ascii-only"), true);
    });
  });
});
