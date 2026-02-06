"use strict";

/**
 * Unit tests for no-heading-like-lines: disallow lines that look like headings
 * (e.g. **Label:** or 1. **Title**) but are not real ATX headings; the rule
 * should suggest using proper # headings instead.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert");
const rule = require("../../.markdownlint-rules/no-heading-like-lines.js");
const { runRule } = require("./run-rule.js");

describe("no-heading-like-lines", () => {
  it("reports no errors for normal text", () => {
    const lines = ["# Real heading", "Some **bold** text.", ""];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports error for **Text:** style", () => {
    // Bold with colon is a common heading-like pattern the rule flags.
    const lines = ["**Summary:**", "Content here."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 1);
    assert.ok(errors[0].detail.includes("proper Markdown headings"));
  });

  it("reports error for 1. **Text** style", () => {
    // Numbered list with bold text looks like a heading.
    const lines = ["1. **Introduction**", "Content."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 1);
  });

  it("ignores empty lines", () => {
    const lines = ["", "   ", ""];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });
});
