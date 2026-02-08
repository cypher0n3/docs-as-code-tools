"use strict";

/**
 * Unit tests for allow-custom-anchors: allow only <a id="..."></a> anchors
 * whose ids match configured regex patterns (allowedIdPatterns). When no
 * patterns are set, no anchors are validated; when set, non-matching ids
 * are reported.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert");
const rule = require("../../.markdownlint-rules/allow-custom-anchors.js");
const { runRule } = require("./run-rule.js");

describe("allow-custom-anchors", () => {
  it("reports no errors when no anchors and no config", () => {
    const lines = ["# Title", "Content"];
    const errors = runRule(rule, lines, {});
    assert.strictEqual(errors.length, 0);
  });

  it("reports error for anchor id not matching allowed pattern", () => {
    // allowedIdPatterns: only ids starting with "spec-" are allowed.
    const lines = ["<a id=\"custom\"></a>", "Content"];
    const errors = runRule(rule, lines, { allowedIdPatterns: ["^spec-"] });
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 1);
    assert.ok(errors[0].detail.includes("allowed") || errors[0].detail.includes("pattern"));
    assert.ok(errors[0].detail.includes("custom"), "detail should include the actual anchor id that was rejected");
  });

  it("reports no errors when anchor id matches allowed pattern", () => {
    const lines = ["<a id=\"spec-intro\"></a>", "Content"];
    const errors = runRule(rule, lines, { allowedIdPatterns: ["^spec-"] });
    assert.strictEqual(errors.length, 0);
  });

  it("ignores anchor inside fenced code block", () => {
    const lines = ["```", "<a id=\"spec-x\"></a>", "```", "<a id=\"custom\"></a>"];
    const errors = runRule(rule, lines, { allowedIdPatterns: ["^spec-"] });
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 4);
  });

  it("applies placement when pattern has placement and strictPlacement is true", () => {
    const lines = ["# Spec", "<a id=\"spec-a\"></a>", "Content"];
    const errors = runRule(rule, lines, {
      allowedIdPatterns: [{ pattern: "^spec-", placement: { headingMatch: "^#\\s+Spec" } }],
      strictPlacement: true,
    });
    assert.strictEqual(errors.length, 0);
  });

  it("reports one-per-line error when two anchors on same line", () => {
    const lines = ["<a id=\"spec-a\"></a> <a id=\"spec-b\"></a>"];
    const errors = runRule(rule, lines, { allowedIdPatterns: ["^spec-"] });
    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].detail.includes("one-per-line"));
  });

  it("reports anchor-format error when line is not valid anchor tag", () => {
    const lines = ["<a id=\"spec-x\" class=\"bad\"></a>"];
    const errors = runRule(rule, lines, { allowedIdPatterns: ["^spec-"] });
    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].detail.includes("anchor") && errors[0].detail.includes("format"));
  });

  it("reports end-of-line error when content appears after anchor", () => {
    const lines = ["<a id=\"spec-x\"></a> trailing text"];
    const errors = runRule(rule, lines, { allowedIdPatterns: ["^spec-"] });
    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].detail.includes("end of the line") || errors[0].detail.includes("end-of-line"));
  });

  it("reports requireAfter error when anchor not followed by blank line", () => {
    const lines = ["# Spec", "<a id=\"spec-a\"></a>", "No blank line after"];
    const errors = runRule(rule, lines, {
      allowedIdPatterns: [{ pattern: "^spec-", placement: { headingMatch: "^#\\s+Spec", requireAfter: ["blank"] } }],
      strictPlacement: true,
    });
    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].detail.includes("requireAfter") && errors[0].detail.includes("blank"));
  });

  it("reports lineMatch error when text before anchor does not match pattern", () => {
    const lines = ["# Spec", "wrong prefix <a id=\"spec-a\"></a>"];
    const errors = runRule(rule, lines, {
      allowedIdPatterns: [{ pattern: "^spec-", placement: { headingMatch: "^#\\s+Spec", lineMatch: "^Spec:" } }],
      strictPlacement: true,
    });
    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].detail.includes("lineMatch"));
  });

  it("reports standaloneLine error when anchor has content before it on same line", () => {
    const lines = ["# Spec", "prefix <a id=\"spec-a\"></a>"];
    const errors = runRule(rule, lines, {
      allowedIdPatterns: [{ pattern: "^spec-", placement: { headingMatch: "^#\\s+Spec", standaloneLine: true } }],
      strictPlacement: true,
    });
    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].detail.includes("standaloneLine"));
  });

  it("reports maxPerSection error when section exceeds allowed anchor count", () => {
    const lines = ["# Spec", "<a id=\"spec-a\"></a>", "<a id=\"spec-b\"></a>"];
    const errors = runRule(rule, lines, {
      allowedIdPatterns: [{ pattern: "^spec-", placement: { headingMatch: "^#\\s+Spec", maxPerSection: 1 } }],
      strictPlacement: true,
    });
    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].detail.includes("maxPerSection"));
  });

  it("reports anchorImmediatelyAfterHeading error when anchor not after heading", () => {
    const lines = ["# Spec", "Content in between", "<a id=\"spec-a\"></a>"];
    const errors = runRule(rule, lines, {
      allowedIdPatterns: [{ pattern: "^spec-", placement: { anchorImmediatelyAfterHeading: true } }],
      strictPlacement: true,
    });
    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].detail.includes("anchorImmediatelyAfterHeading"));
  });

  it("reports requireAfter fencedBlock error when not followed by fenced code block", () => {
    const lines = ["# Spec", "<a id=\"spec-a\"></a>", "", "plain text not a fence"];
    const errors = runRule(rule, lines, {
      allowedIdPatterns: [{ pattern: "^spec-", placement: { headingMatch: "^#\\s+Spec", requireAfter: ["blank", "fencedBlock"] } }],
      strictPlacement: true,
    });
    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].detail.includes("fenced") && errors[0].detail.includes("requireAfter"));
  });

  it("reports requireAfter list error when not followed by list", () => {
    const lines = ["# Spec", "<a id=\"spec-a\"></a>", "", "plain paragraph"];
    const errors = runRule(rule, lines, {
      allowedIdPatterns: [{ pattern: "^spec-", placement: { headingMatch: "^#\\s+Spec", requireAfter: ["blank", "list"] } }],
      strictPlacement: true,
    });
    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].detail.includes("list") && errors[0].detail.includes("requireAfter"));
  });

  it("reports no errors when anchor followed by blank and fenced block (requireAfter fencedBlock pass)", () => {
    const lines = ["# Spec", "<a id=\"spec-a\"></a>", "", "```", "code", "```"];
    const errors = runRule(rule, lines, {
      allowedIdPatterns: [{ pattern: "^spec-", placement: { headingMatch: "^#\\s+Spec", requireAfter: ["blank", "fencedBlock"] } }],
      strictPlacement: true,
    });
    assert.strictEqual(errors.length, 0);
  });

  it("reports no errors when requireAfter is fencedBlock only and next line is fence (needBlank false)", () => {
    const lines = ["# Spec", "<a id=\"spec-a\"></a>", "```", "code"];
    const errors = runRule(rule, lines, {
      allowedIdPatterns: [{ pattern: "^spec-", placement: { headingMatch: "^#\\s+Spec", requireAfter: ["fencedBlock"] } }],
      strictPlacement: true,
    });
    assert.strictEqual(errors.length, 0);
  });

  it("reports no errors when requireAfter blank and list are satisfied (return null path)", () => {
    const lines = ["# Spec", "<a id=\"spec-a\"></a>", "", "- item"];
    const errors = runRule(rule, lines, {
      allowedIdPatterns: [{ pattern: "^spec-", placement: { headingMatch: "^#\\s+Spec", requireAfter: ["blank", "list"] } }],
      strictPlacement: true,
    });
    assert.strictEqual(errors.length, 0);
  });
});
