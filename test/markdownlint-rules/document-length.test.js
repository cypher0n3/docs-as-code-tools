"use strict";

/**
 * Unit tests for document-length: disallow documents longer than a configured
 * maximum number of lines; reports one error on line 1 when over the limit.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert");
const rule = require("../../markdownlint-rules/document-length.js");
const { runRule } = require("./run-rule.js");

function makeLines(n) {
  return Array.from({ length: n }, (_, i) => (i === 0 ? "# Title" : `line ${i + 1}`));
}

describe("document-length", () => {
  it("skips when file path matches excludePathPatterns", () => {
    const lines = makeLines(1501);
    const config = { excludePathPatterns: ["**/long.md"] };
    const errors = runRule(rule, lines, config, "docs/long.md");
    assert.strictEqual(errors.length, 0);
  });

  it("reports no errors when lines.length <= maximum (default 1500)", () => {
    const lines = makeLines(1500);
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports one error when lines.length > maximum (1501 lines)", () => {
    const lines = makeLines(1501);
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 1);
    assert.ok(errors[0].detail.includes("1501") && errors[0].detail.includes("1500"));
    assert.ok(errors[0].detail.includes("maximum") || errors[0].detail.includes("Consider splitting"));
  });

  it("respects custom maximum: 11 lines with max 10 reports one error", () => {
    const lines = makeLines(11);
    const errors = runRule(rule, lines, { maximum: 10 });
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 1);
    assert.ok(errors[0].detail.includes("11") && errors[0].detail.includes("10"));
  });

  it("respects custom maximum: 10 lines with max 10 reports no error", () => {
    const lines = makeLines(10);
    const errors = runRule(rule, lines, { maximum: 10 });
    assert.strictEqual(errors.length, 0);
  });

  it("reports no error for 0 lines", () => {
    const errors = runRule(rule, []);
    assert.strictEqual(errors.length, 0);
  });

  it("reports no error for 1 line when max is 1", () => {
    const errors = runRule(rule, ["only line"], { maximum: 1 });
    assert.strictEqual(errors.length, 0);
  });

  it("reports one error for 2 lines when max is 1", () => {
    const errors = runRule(rule, ["first", "second"], { maximum: 1 });
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 1);
  });

  it("uses default maximum when config.maximum is not a positive integer", () => {
    const lines = makeLines(1501);
    const errors = runRule(rule, lines, { maximum: "1500" });
    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].detail.includes("1500"));
  });

  it("uses top-level maximum when rule block has no maximum", () => {
    const lines = makeLines(11);
    const config = { "document-length": {}, maximum: 10 };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].detail.includes("11") && errors[0].detail.includes("10"));
  });

  it("uses rule-level maximum when config has document-length block", () => {
    const lines = makeLines(11);
    const config = { "document-length": { maximum: 10 } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].detail.includes("11") && errors[0].detail.includes("10"));
  });

  it("skips when params.config is undefined (branch coverage)", () => {
    const lines = makeLines(1501);
    const errors = [];
    rule.function({ lines, config: undefined, name: "x.md" }, (e) => errors.push(e));
    assert.strictEqual(errors.length, 1, "no excludePathPatterns so rule runs and reports over limit");
  });

  it("reports error with empty context when first line is undefined (over limit)", () => {
    const lines = Array(2);
    lines[1] = "second";
    const errors = runRule(rule, lines, { maximum: 1 });
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].context, "");
  });

  describe("HTML comment suppress", () => {
    it("reports no error when line 1 is solely the suppress comment (over limit)", () => {
      const lines = ["<!-- document-length allow -->", "second line"];
      const config = { "document-length": { maximum: 1 } };
      const errors = runRule(rule, lines, config);
      assert.strictEqual(errors.length, 0);
    });

    it("reports no error when line 1 ends with the suppress comment (over limit)", () => {
      const lines = ["# Title <!-- document-length allow -->", "second line"];
      const config = { "document-length": { maximum: 1 } };
      const errors = runRule(rule, lines, config);
      assert.strictEqual(errors.length, 0);
    });

    it("reports error when over limit and no suppress comment", () => {
      const lines = ["# Title", "second line"];
      const config = { "document-length": { maximum: 1 } };
      const errors = runRule(rule, lines, config);
      assert.strictEqual(errors.length, 1);
    });
  });

  describe("edge cases", () => {
    it("maximum 0 uses default maximum (1500)", () => {
      const lines = makeLines(10);
      const errors = runRule(rule, lines, { maximum: 0 });
      assert.strictEqual(errors.length, 0);
    });

    it("maximum negative uses default maximum", () => {
      const lines = makeLines(10);
      const errors = runRule(rule, lines, { maximum: -1 });
      assert.strictEqual(errors.length, 0);
    });

    it("rule-level config block with empty object uses top-level maximum", () => {
      const lines = makeLines(1501);
      const config = { "document-length": {}, maximum: 1500 };
      const errors = runRule(rule, lines, config);
      assert.strictEqual(errors.length, 1);
    });
  });
});
