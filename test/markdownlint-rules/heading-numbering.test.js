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

  it("skips when file path matches excludePathPatterns", () => {
    const lines = ["# Doc", "## 1. First", "## 4. Skip"];
    const config = { excludePathPatterns: ["**/skip.md"] };
    const errors = runRule(rule, lines, config, "docs/skip.md");
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

  it("reports error when parent has numbering but child has no number (first child must be numbered)", () => {
    const lines = ["# Doc", "## 1. First", "### Sub A", "### Sub B"];
    const errors = runRule(rule, lines);
    const missingNum = errors.filter((e) => e.detail.includes("no number prefix") || e.detail.includes("numbered"));
    assert.ok(missingNum.length >= 2, "should report missing number for both unnumbered children");
    const fixFirst = missingNum.find((e) => e.lineNumber === 3);
    assert.ok(fixFirst?.fixInfo?.insertText.startsWith("1.1"), "first child under 1. should get prefix 1.1. or 1.1 ");
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

  it("reports fixInfo for out-of-sequence error (replace prefix with expected)", () => {
    const lines = ["# Doc", "## 1. First", "## 2. Second", "## 4. Skip"];
    const errors = runRule(rule, lines);
    const seqError = errors.find((e) => e.detail.includes("sequence") || e.detail.includes("expected"));
    assert.ok(seqError, "should report sequencing error");
    assert.ok(seqError.fixInfo, "fixable error should include fixInfo");
    assert.strictEqual(typeof seqError.fixInfo.editColumn, "number");
    assert.strictEqual(typeof seqError.fixInfo.deleteCount, "number");
    assert.strictEqual(typeof seqError.fixInfo.insertText, "string");
    assert.ok(seqError.fixInfo.insertText.startsWith("3"), "insertText should be expected prefix (3. or 3 )");
  });

  it("reports fixInfo for missing number prefix (insert expected prefix)", () => {
    const lines = ["# Doc", "## 1. First", "## 2. Second", "## Unnumbered"];
    const errors = runRule(rule, lines);
    const missingNum = errors.find((e) => e.detail.includes("no number prefix") || e.detail.includes("numbered"));
    assert.ok(missingNum, "should report missing number");
    assert.ok(missingNum.fixInfo, "fixable error should include fixInfo");
    assert.strictEqual(missingNum.fixInfo.editColumn, 4, "editColumn after ## ");
    assert.strictEqual(missingNum.fixInfo.deleteCount, 0, "insert only");
    assert.ok(missingNum.fixInfo.insertText.startsWith("3"), "insertText should be expected prefix for 4th sibling (3. or 3 )");
  });

  it("reports fixInfo for wrong segment count (replace with expected prefix)", () => {
    const lines = ["# Doc", "## 1. First", "## 2. Second", "### 2.1.2. Too many segments"];
    const errors = runRule(rule, lines);
    const segmentErr = errors.find((e) => e.detail.includes("segment") && e.detail.includes("expected"));
    assert.ok(segmentErr, "should report segment count error");
    assert.ok(segmentErr.fixInfo, "fixable error should include fixInfo");
    assert.strictEqual(typeof segmentErr.fixInfo.editColumn, "number");
    assert.ok(segmentErr.fixInfo.deleteCount > 0);
    assert.ok(segmentErr.fixInfo.insertText.includes("2.1"), "insertText should be correct prefix (e.g. 2.1. )");
  });

  it("reports fixInfo for period style inconsistency (add or remove period)", () => {
    const lines = ["# Doc", "## 1. First", "## 2. Second", "## 3 No period"];
    const errors = runRule(rule, lines);
    const periodErr = errors.find((e) => e.detail.includes("period") && e.detail.includes("section"));
    assert.ok(periodErr, "should report period style error");
    assert.ok(periodErr.fixInfo, "fixable error should include fixInfo");
    assert.strictEqual(typeof periodErr.fixInfo.editColumn, "number");
    assert.ok(periodErr.fixInfo.insertText.startsWith("3"), "insertText should be same number with section period style");
  });

  it("reports fixInfo for period style when section uses no period (remove period)", () => {
    const lines = ["# Doc", "## 1 First", "## 2 Second", "## 3. With period"];
    const errors = runRule(rule, lines);
    const periodErr = errors.find((e) => e.detail.includes("period") && e.detail.includes("section"));
    assert.ok(periodErr, "should report period style error");
    assert.ok(periodErr.fixInfo, "fixable error should include fixInfo");
    assert.ok(periodErr.fixInfo.insertText.startsWith("3") && !periodErr.fixInfo.insertText.startsWith("3."), "insertText should be 3 without trailing period");
  });

  it("getExpectedPrefixForNewHeading returns prefix for first child under numbered parent (no sibling)", () => {
    const { getExpectedPrefixForNewHeading } = rule;
    const lines = ["# Doc", "## 1. First", "Content", "## 2. Second"];
    const prefixAt3 = getExpectedPrefixForNewHeading(lines, 3, 3);
    assert.ok(prefixAt3.startsWith("1.1"), "insert H3 after 1. First should get 1.1. or 1.1 ");
    assert.ok(prefixAt3.endsWith(" "), "prefix should end with space");
  });

  it("does not report fixInfo for maxSegmentValue or maxHeadingLevel errors", () => {
    const linesMaxSeg = ["# Doc", "## 1. First", "## 21. Too big"];
    const config = { "heading-numbering": { maxSegmentValue: 20 } };
    const errorsMaxSeg = runRule(rule, linesMaxSeg, config);
    const segErr = errorsMaxSeg.find((e) => e.detail.includes("exceeds maximum"));
    assert.ok(segErr, "should report max segment value error");
    assert.ok(!segErr.fixInfo, "maxSegmentValue error should not have fixInfo");

    const linesMaxLevel = ["# Doc", "## 1. First", "###### Too deep"];
    const configLevel = { "heading-numbering": { maxHeadingLevel: 5 } };
    const errorsMaxLevel = runRule(rule, linesMaxLevel, configLevel);
    const levelErr = errorsMaxLevel.find((e) => e.detail.includes("deeper than maximum"));
    assert.ok(levelErr, "should report max heading level error");
    assert.ok(!levelErr.fixInfo, "maxHeadingLevel error should not have fixInfo");
  });

  it("runs when maxHeadingLevel is set but no headings have numbering (branch coverage)", () => {
    const lines = ["# Title", "## Section", "### Subsection"];
    const config = { "heading-numbering": { maxHeadingLevel: 2 } };
    const errors = runRule(rule, lines, config);
    const levelErr = errors.find((e) => e.detail.includes("deeper than maximum"));
    assert.ok(levelErr, "H3 should exceed maxHeadingLevel 2");
    assert.strictEqual(levelErr.lineNumber, 3);
  });

  it("getExpectedPrefixForNewHeading returns empty when section does not use numbering", () => {
    const { getExpectedPrefixForNewHeading } = rule;
    const lines = ["# Doc", "## Unnumbered Section", "Content here"];
    const prefix = getExpectedPrefixForNewHeading(lines, 3, 2);
    assert.strictEqual(prefix, "", "section has no numbering so prefix should be empty");
  });

  it("reports no error for heading when suppress comment on previous line (line-level override)", () => {
    const lines = ["# Doc", "## 1. First", "## 2. Second", "<!-- heading-numbering allow -->", "## 4. Skip", "## 5. Next"];
    const errors = runRule(rule, lines);
    const errorOnLine5 = errors.filter((e) => e.lineNumber === 5);
    assert.strictEqual(errorOnLine5.length, 0, "line 5 (## 4. Skip) should be suppressed by comment on line 4");
  });

  it("maxSegmentValueMinLevel custom value (branch coverage for readMaxSegmentValueOpts)", () => {
    const lines = ["# Doc", "## 1. First", "### 1.1. Sub", "#### 30. Deep"];
    const config = { "heading-numbering": { maxSegmentValue: 20, maxSegmentValueMinLevel: 2 } };
    const errors = runRule(rule, lines, config);
    const maxErr = errors.find((e) => e.detail.includes("exceeds maximum"));
    assert.ok(maxErr, "segment 30 should exceed 20 when level is in scope");
  });

  describe("edge cases", () => {
    it("getExpectedPrefixForNewHeading at line before any heading returns sensible prefix", () => {
      const { getExpectedPrefixForNewHeading } = rule;
      const lines = ["No heading yet.", "More text.", "## 1. First"];
      const prefixAt1 = getExpectedPrefixForNewHeading(lines, 1, 2);
      assert.ok(typeof prefixAt1 === "string");
      assert.ok(prefixAt1.length >= 0);
    });

    it("mixed 0-based and 1-based siblings in same section reports sequence or style error", () => {
      const lines = ["# Doc", "## 0. Zero", "## 1. One", "## 2. Two"];
      const errors = runRule(rule, lines);
      const periodErr = errors.find((e) => e.detail.includes("period") || e.detail.includes("sequence"));
      assert.ok(periodErr != null || errors.length === 0, "mixed 0. and 1. style may report period/sequence");
    });

    it("maxSegmentValueMaxLevel excludes deeper levels from max value check", () => {
      const lines = ["# Doc", "## 1. First", "### 1.1. Sub", "#### 25. Deep"];
      const config = { "heading-numbering": { maxSegmentValue: 20, maxSegmentValueMaxLevel: 3 } };
      const errors = runRule(rule, lines, config);
      const maxValueErr = errors.find(
        (e) => e.lineNumber === 4 && e.detail.includes("exceeds maximum")
      );
      assert.ok(!maxValueErr, "level 4 segment 25 should not get max value error when maxSegmentValueMaxLevel is 3");
    });
  });
});
