"use strict";

/**
 * Unit tests for heading-title-case: enforce AP-style headline capitalization
 * (first/last/subphrase-start capitalized; minor words lowercase in middle;
 * hyphenated segments and first word after colon checked). Words in backticks
 * are ignored; lowercase words are configurable.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert");
const rule = require("../../markdownlint-rules/heading-title-case.js");
const { runRule } = require("./run-rule.js");

describe("heading-title-case", () => {
  it("reports no errors for valid title case", () => {
    // AP style: "is" and "a" lowercase in middle; first/last capitalized
    const lines = ["# This is a Valid Title", "## Another Good Heading"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports error when middle word should be lowercase", () => {
    // Default lowercase list includes "is" and "and"; "Is" and "And" in the middle are invalid.
    const lines = ["# This Is And Valid"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 2, "both 'Is' and 'And' should be reported");
    assert.strictEqual(errors[0].lineNumber, 1);
    assert.strictEqual(errors[1].lineNumber, 1);
    const details = errors.map((e) => e.detail);
    assert.ok(details.some((d) => d.includes("Is") && d.includes("lowercase")), "one error for 'Is'");
    assert.ok(details.some((d) => d.includes("And") && d.includes("lowercase")), "one error for 'And'");
    assert.ok(Array.isArray(errors[0].range) && errors[0].range.length === 2, "error should include range [column, length] for the violating word");
  });

  it("allows lowercase in the middle when lowercaseWords extends default", () => {
    // Config extends default: "through" added; "and" already in default. First/last ("Use", "Other") stay capped.
    const lines = ["# Use through and Other"];
    const errors = runRule(rule, lines, {
      "heading-title-case": { lowercaseWords: ["through"] },
    });
    assert.strictEqual(errors.length, 0);
  });

  it("lowercaseWordsReplaceDefault: true uses only config list", () => {
    const lines = ["# This And That"];
    const errors = runRule(rule, lines, {
      "heading-title-case": { lowercaseWords: ["and"], lowercaseWordsReplaceDefault: true },
    });
    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].detail.includes("And") && errors[0].detail.includes("lowercase"));
  });

  it("lowercaseWordsReplaceDefault: false (default) merges config with default", () => {
    const lines = ["# Use through and Other"];
    const errors = runRule(rule, lines, {
      "heading-title-case": { lowercaseWords: ["through"], lowercaseWordsReplaceDefault: false },
    });
    assert.strictEqual(errors.length, 0);
  });

  it("reports error with range pointing to the violating word", () => {
    const lines = ["# The Cat And the Hat"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1, "only 'And' reported ('the' is already lowercase)");
    assert.strictEqual(errors[0].lineNumber, 1);
    assert.ok(Array.isArray(errors[0].range) && errors[0].range.length === 2);
    const [col, len] = errors[0].range;
    assert.strictEqual(len, 3, "range length should match word 'And'");
    const line = lines[0];
    const wordAtRange = line.slice(col - 1, col - 1 + len);
    assert.strictEqual(wordAtRange, "And", "range should highlight the violating word");
  });

  it("reports first-word violation with expected case in detail", () => {
    const lines = ["## getting started"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 2, "both 'getting' (first) and 'started' (last) should be capitalized");
    const details = errors.map((e) => e.detail);
    assert.ok(details.some((d) => d.includes("getting") && (d.includes("capitalized") || d.includes("first"))));
    assert.ok(details.some((d) => d.includes("started") && (d.includes("capitalized") || d.includes("last"))));
  });

  it("reports last-word violation with expected case in detail", () => {
    const lines = ["## Using Tools in practice"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1, "only 'practice' reported ('in' is already lowercase)");
    assert.ok(errors[0].detail.includes("practice"));
    assert.ok(errors[0].detail.includes("capitalized") || errors[0].detail.includes("last"));
  });

  it("accepts valid hyphenated compounds (AP: each segment capitalized)", () => {
    const lines = ["# One-Stop Shop", "## How to Do a Follow-Up"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports error for lowercase segment in hyphenated word", () => {
    const lines = ["# One-stop Shop"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].detail.includes("stop") && errors[0].detail.includes("capitalized"));
  });

  it("capitalizes first word after colon (AP subphrase start)", () => {
    const lines = ["## Summary: The Results"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports error when first word after colon is lowercase", () => {
    const lines = ["## Summary: the Results"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].detail.includes("the") && errors[0].detail.includes("capitalized"));
  });

  it("reports no errors for heading that is only inline code (words.length === 0)", () => {
    const lines = ["## `code only`"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports no errors for word with bracket prefix (firstAlphaIdx > 0)", () => {
    const lines = ["## (Optional) Section Title"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports no errors for hyphenated word with punctuation-only segment (skip non-alpha segment)", () => {
    const lines = ["## Test---Here"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports error for hyphenated word with range on segment (segmentOffset/segmentLength)", () => {
    const lines = ["# One-stop Shop"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.ok(Array.isArray(errors[0].range) && errors[0].range.length === 2);
    assert.strictEqual(errors[0].range[1], 4, "range length should be segment 'stop'");
  });

  it("allows capitalized first segment of hyphenated compound when that word is in lowercase list (e.g. Per-Section)", () => {
    const lines = ["## Heading With Per-Section in Name"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  describe("fixInfo (auto-fix)", () => {
    it("reports fixInfo with editColumn, deleteCount, insertText for middle-word lowercase violation", () => {
      const lines = ["# The Cat And the Hat"];
      const errors = runRule(rule, lines);
      const andError = errors.find((e) => e.detail && e.detail.includes("And"));
      assert.ok(andError, "error for 'And' should be reported");
      assert.ok(andError.fixInfo, "fixable error should include fixInfo");
      assert.strictEqual(typeof andError.fixInfo.editColumn, "number");
      assert.strictEqual(typeof andError.fixInfo.deleteCount, "number");
      assert.strictEqual(typeof andError.fixInfo.insertText, "string");
      assert.strictEqual(andError.fixInfo.insertText, "and", "insertText should correct 'And' to lowercase 'and'");
    });

    it("reports fixInfo with insertText capitalizing last word", () => {
      const lines = ["## Using Tools in practice"];
      const errors = runRule(rule, lines);
      const practiceError = errors.find((e) => e.detail && e.detail.includes("practice"));
      assert.ok(practiceError, "error for 'practice' should be reported");
      assert.ok(practiceError.fixInfo);
      assert.strictEqual(practiceError.fixInfo.insertText, "Practice", "insertText should capitalize 'practice' to 'Practice'");
    });

    it("reports fixInfo with insertText capitalizing first word", () => {
      const lines = ["## getting started"];
      const errors = runRule(rule, lines);
      const gettingError = errors.find((e) => e.detail && e.detail.includes("getting"));
      assert.ok(gettingError, "error for 'getting' should be reported");
      assert.ok(gettingError.fixInfo);
      assert.strictEqual(gettingError.fixInfo.insertText, "Getting", "insertText should capitalize 'getting' to 'Getting'");
    });

    it("reports fixInfo for hyphenated segment (correct segment only)", () => {
      const lines = ["# One-stop Shop"];
      const errors = runRule(rule, lines);
      assert.strictEqual(errors.length, 1);
      assert.ok(errors[0].fixInfo);
      assert.strictEqual(errors[0].fixInfo.insertText, "Stop", "insertText should capitalize segment 'stop' to 'Stop'");
    });
  });

  describe("applyTitleCase (export)", () => {
    it("handles hyphenated word with punctuation-only segment (coverage)", () => {
      assert.strictEqual(typeof rule.applyTitleCase, "function");
      const result = rule.applyTitleCase("Test---Here");
      assert.strictEqual(result, "Test---Here", "punctuation-only segments preserved");
    });

    it("accepts lowercaseWords as Set (coverage)", () => {
      const result = rule.applyTitleCase("use and through", {
        lowercaseWords: new Set(["and", "through"]),
      });
      assert.strictEqual(result, "Use and Through");
    });

    it("lowercaseWordsReplaceDefault: true uses only config list (coverage)", () => {
      const result = rule.applyTitleCase("a and the b", {
        lowercaseWords: ["and", "the"],
        lowercaseWordsReplaceDefault: true,
      });
      assert.strictEqual(result, "A and the B");
    });
  });
});
