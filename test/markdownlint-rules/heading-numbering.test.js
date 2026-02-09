"use strict";

/**
 * Unit tests for heading-numbering: enforce consistent numbered headings
 * (segment count by numbering root, sequential numbering within a section,
 * consistent period style). The rule only runs when at least one heading
 * has a number prefix; unnumbered headings are ignored.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert");
const rule = require("../../markdownlint-rules/heading-numbering.js");
const { runRule } = require("./run-rule.js");

describe("heading-numbering", () => {
  it("reports no errors when no numbered headings", () => {
    const lines = ["# Title", "## Section", "Content"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports no errors for consistent numbering", () => {
    // Siblings 1., 2.; subsection 2.1. under 2. is valid.
    const lines = ["# Doc", "## 1. First", "## 2. Second", "### 2.1. Sub"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports error for non-sequential numbering in section", () => {
    // After 1. and 2., next sibling should be 3., not 4.
    const lines = ["# Doc", "## 1. First", "## 2. Second", "## 4. Skip"];
    const errors = runRule(rule, lines);
    assert.ok(errors.length >= 1);
    const seqError = errors.find((e) => e.detail.includes("sequence") || e.detail.includes("expected"));
    assert.ok(seqError, "should report a sequencing error");
    assert.ok(seqError.detail.includes("4"), "detail should include the actual prefix");
    assert.ok(seqError.detail.includes("3"), "detail should include the expected prefix");
  });

  it("reports error when heading in numbered section has no number prefix", () => {
    const lines = ["# Doc", "## 1. First", "## 2. Second", "## Unnumbered"];
    const errors = runRule(rule, lines);
    const missingNum = errors.find((e) => e.detail.includes("no number prefix") || e.detail.includes("numbered"));
    assert.ok(missingNum, "should report missing number in numbered section");
    assert.strictEqual(missingNum.lineNumber, 4);
  });

  it("reports error for wrong segment count (level vs numbering depth)", () => {
    const lines = ["# Doc", "## 1. First", "## 2. Second", "### 2.1.2. Too many segments"];
    const errors = runRule(rule, lines);
    const segmentErr = errors.find((e) => e.detail.includes("segment") && e.detail.includes("expected"));
    assert.ok(segmentErr, "should report segment count error");
  });

  it("reports error for period style inconsistency in section", () => {
    const lines = ["# Doc", "## 1. First", "## 2. Second", "## 3 No period"];
    const errors = runRule(rule, lines);
    const periodErr = errors.find((e) => e.detail.includes("period") && e.detail.includes("section"));
    assert.ok(periodErr, "should report period style inconsistency");
  });

  it("accepts 0-based numbering in section (0., 1., 2.)", () => {
    const lines = ["# Doc", "## 0. Zero", "## 1. One", "## 2. Two"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("accepts 0-based subsections under 0-based section (0.0., 0.1. under 0.)", () => {
    const lines = ["# Doc", "## 0. Zero", "### 0.0. First", "### 0.1. Second"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports no errors for unnumbered subsections under numbered section", () => {
    const lines = ["# Doc", "## 1. First", "### Sub A", "### Sub B"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports segment error when root heading has number prefix (exercises numbering root level 1)", () => {
    const lines = ["# 1. Root", "## 1.1. Child"];
    const errors = runRule(rule, lines);
    const segmentErr = errors.find((e) => e.detail.includes("segment"));
    assert.ok(segmentErr, "root with number prefix should report segment count error");
  });

  it("reports no errors for numbered H2s and H3 under one H2 (getSiblings level/parent branches)", () => {
    const lines = ["# Doc", "## 1. First", "## 2. Second", "### 2.1. Sub"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("maxHeadingLevel: 5 reports H6", () => {
    const lines = ["# Doc", "## 1. First", "### 1.1. Sub", "#### 1.1.1. A", "##### 1.1.1.1. B", "###### Too deep"];
    const config = { "heading-numbering": { maxHeadingLevel: 5 } };
    const errors = runRule(rule, lines, config);
    const maxDepthErr = errors.find((e) => e.detail.includes("deeper than maximum"));
    assert.ok(maxDepthErr, "should report max heading level error");
    assert.strictEqual(maxDepthErr.lineNumber, 6);
  });

  it("maxHeadingLevel: 5 allows H2–H5", () => {
    const lines = ["# Doc", "## 1. First", "### 1.1. Sub", "#### 1.1.1. A", "##### 1.1.1.1. B"];
    const config = { "heading-numbering": { maxHeadingLevel: 5 } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 0);
  });

  it("maxSegmentValue: 20 reports segment exceeding 20", () => {
    const lines = ["# Doc", "## 1. First", "## 21. Too big"];
    const config = { "heading-numbering": { maxSegmentValue: 20 } };
    const errors = runRule(rule, lines, config);
    const segErr = errors.find((e) => e.detail.includes("exceeds maximum allowed value"));
    assert.ok(segErr, "should report max segment value error");
    assert.ok(segErr.detail.includes("21"));
  });

  it("maxSegmentValue: 20 allows segments up to 20", () => {
    const lines = ["# Doc", "## 1. Only"];
    const config = { "heading-numbering": { maxSegmentValue: 20 } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 0);
  });

  it("maxSegmentValue with maxSegmentValueMaxLevel only checks up to that level", () => {
    const lines = ["# Doc", "## 1. First", "### 1.1. Sub", "#### 1.1.1. Deep segment"];
    const config = { "heading-numbering": { maxSegmentValue: 20, maxSegmentValueMinLevel: 1, maxSegmentValueMaxLevel: 3 } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 0);
  });
});
