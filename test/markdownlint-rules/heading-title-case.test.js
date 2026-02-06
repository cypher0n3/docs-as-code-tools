"use strict";

/**
 * Unit tests for heading-title-case: enforce title case on headings (first/last
 * and major words capitalized; small words like "and"/"the" lowercase in the
 * middle). Words in backticks are ignored; lowercase words are configurable.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert");
const rule = require("../../.markdownlint-rules/heading-title-case.js");
const { runRule } = require("./run-rule.js");

describe("heading-title-case", () => {
  it("reports no errors for valid title case", () => {
    const lines = ["# This Is a Valid Title", "## Another Good Heading"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports error when middle word should be lowercase", () => {
    // Default lowercase list includes "and"; "And" in the middle is invalid.
    const lines = ["# This Is And Valid"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 1);
    assert.ok(errors[0].detail.includes("lowercase"));
  });

  it("allows lowercase and/or in the middle when configured", () => {
    // Custom lowercaseWords permits "of" and "and"; first/last ("Use", "Other") stay capped.
    const lines = ["# Use of and Other"];
    const errors = runRule(rule, lines, {
      "heading-title-case": { lowercaseWords: ["of", "and"] },
    });
    assert.strictEqual(errors.length, 0);
  });
});
