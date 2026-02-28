"use strict";

/**
 * Unit tests for no-heading-like-lines: disallow lines that look like headings
 * (e.g. **Label:** or 1. **Title**) but are not real ATX headings; the rule
 * should suggest using proper # headings instead.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const rule = require("../../markdownlint-rules/no-heading-like-lines.js");
const { runRule } = require("./run-rule.js");

const RULES_DIR = path.join(__dirname, "..", "..", "markdownlint-rules");

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
    assert.ok(errors[0].detail.includes("ATX heading") && errors[0].detail.includes("heading-like"));
    assert.ok(errors[0].detail.includes("bold") && errors[0].detail.includes("colon"), "detail should describe the matched pattern");
  });

  it("reports no error when suppress comment on previous line (line-level override)", () => {
    const lines = ["<!-- no-heading-like-lines allow -->", "**Summary:**", "Content here."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports error for 1. **Text** style", () => {
    // Numbered list with bold text looks like a heading.
    const lines = ["1. **Introduction**", "Content."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 1);
    assert.ok(errors[0].detail.includes("numbered") || errors[0].detail.includes("bold"), "detail should describe the matched pattern");
  });

  it("does not report numbered list when bold content ends with sentence punctuation", () => {
    const lines = ["3. **This should not be flagged.**", "Content."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0, "1. **Sentence.** should not be flagged as heading-like");
  });

  it("reports error for MD036-style **Introduction** (whole line bold)", () => {
    const lines = ["**Introduction**", "Content here."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 1);
    assert.ok(errors[0].detail.includes("bold only") || errors[0].detail.includes("whole line"), "detail should describe whole-line bold");
  });

  it("reports error for MD036-style *Note* (whole line italic)", () => {
    const lines = ["*Note*", "Content here."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 1);
    assert.ok(errors[0].detail.includes("italic only") || errors[0].detail.includes("whole line"), "detail should describe whole-line italic");
  });

  it("does not report **Summary.** when content ends with punctuation (punctuationMarks)", () => {
    const lines = ["**Summary.**", "Content."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0, "whole-line bold ending with . should be skipped by default punctuationMarks");
  });

  it("does not report *Note.* when content ends with punctuation", () => {
    const lines = ["*Note.*", "Content."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports **Summary.** when punctuationMarks is empty", () => {
    const lines = ["**Summary.**", "Content."];
    const config = { "no-heading-like-lines": { punctuationMarks: "" } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].fixInfo.insertText, "Summary.");
  });

  it("ignores empty lines", () => {
    const lines = ["", "   ", ""];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("skips rule when file path matches excludePathPatterns", () => {
    const lines = ["**Summary:**", "Content."];
    const config = { "no-heading-like-lines": { excludePathPatterns: ["**/README.md", "docs/**"] } };
    const errorsMatch = runRule(rule, lines, config, "project/README.md");
    assert.strictEqual(errorsMatch.length, 0, "matching path should be excluded");
    const errorsNoMatch = runRule(rule, lines, config, "project/src/guide.md");
    assert.strictEqual(errorsNoMatch.length, 1, "non-matching path should report error");
  });

  it("skips when file path matches excludePathPatterns (top-level config)", () => {
    const lines = ["**Summary:**", "Content."];
    const config = { excludePathPatterns: ["**"] };
    const errors = runRule(rule, lines, config, "any.md");
    assert.strictEqual(errors.length, 0);
  });

  it("uses default heading level 2 when defaultHeadingLevel is invalid", () => {
    const lines = ["**Summary:**", "Content."];
    const config = { "no-heading-like-lines": { convertToHeading: true, defaultHeadingLevel: 0 } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].fixInfo.insertText.startsWith("## "), "invalid defaultHeadingLevel falls back to 2");
  });

  it("skips when file path matches excludePathPatterns (rule-level config)", () => {
    const lines = ["**Summary:**", "Content."];
    const config = { "no-heading-like-lines": { excludePathPatterns: ["**"] } };
    const errors = runRule(rule, lines, config, "any.md");
    assert.strictEqual(errors.length, 0);
  });

  describe("fixInfo (default stripEmphasis)", () => {
    it("provides fixInfo for **Summary:** with editColumn 1, deleteCount line length, insertText plain", () => {
      const lines = ["**Summary:**", "Content."];
      const config = {};
      const errors = runRule(rule, lines, config);
      assert.strictEqual(errors.length, 1);
      assert.strictEqual(errors[0].fixInfo.editColumn, 1);
      assert.strictEqual(errors[0].fixInfo.deleteCount, "**Summary:**".length);
      assert.strictEqual(errors[0].fixInfo.insertText, "Summary");
    });

    it("provides fixInfo for 1. **Introduction** with insertText Introduction", () => {
      const lines = ["1. **Introduction**", "Content."];
      const errors = runRule(rule, lines, {});
      assert.strictEqual(errors.length, 1);
      assert.strictEqual(errors[0].fixInfo.insertText, "Introduction");
    });

    it("provides fixInfo for **Introduction** (whole line bold) with insertText Introduction", () => {
      const lines = ["**Introduction**", "Content."];
      const errors = runRule(rule, lines, {});
      assert.strictEqual(errors.length, 1);
      assert.strictEqual(errors[0].fixInfo.insertText, "Introduction");
    });

    it("provides fixInfo for *Note* (whole line italic) with insertText Note", () => {
      const lines = ["*Note*", "Content."];
      const errors = runRule(rule, lines, {});
      assert.strictEqual(errors.length, 1);
      assert.strictEqual(errors[0].fixInfo.insertText, "Note");
    });
  });

  describe("fixInfo (convertToHeading: true)", () => {
    const convertConfig = { "no-heading-like-lines": { convertToHeading: true } };

    it("suggests ### when preceded by ## Section and title is AP title-cased", () => {
      const lines = ["## Section", "**The Quick Brown:**", "Content."];
      const errors = runRule(rule, lines, convertConfig);
      assert.strictEqual(errors.length, 1);
      assert.ok(errors[0].fixInfo.insertText.startsWith("### "), "insertText should be ### ...");
      assert.ok(errors[0].fixInfo.insertText.includes("The Quick Brown"), "minor words lowercase in middle");
    });

    it("suggests ## when no preceding heading (default level 2)", () => {
      const lines = ["**Title:**", "Content."];
      const errors = runRule(rule, lines, convertConfig);
      assert.strictEqual(errors.length, 1);
      assert.ok(errors[0].fixInfo.insertText.startsWith("## "), "insertText should be ## ...");
      assert.ok(errors[0].fixInfo.insertText.includes("Title"));
    });

    it("invalid defaultHeadingLevel falls back to level 2", () => {
      const lines = ["**Title:**", "Content."];
      const config = { "no-heading-like-lines": { convertToHeading: true, defaultHeadingLevel: 0 } };
      const errors = runRule(rule, lines, config);
      assert.strictEqual(errors.length, 1);
      assert.ok(errors[0].fixInfo.insertText.startsWith("## "), "invalid defaultHeadingLevel should fall back to ##");
    });

    it("valid defaultHeadingLevel 3 suggests ### (getContextLevel branch)", () => {
      const lines = ["**Title:**", "Content."];
      const config = { "no-heading-like-lines": { convertToHeading: true, defaultHeadingLevel: 3 } };
      const errors = runRule(rule, lines, config);
      assert.strictEqual(errors.length, 1);
      assert.ok(errors[0].fixInfo.insertText.startsWith("### "), "defaultHeadingLevel 3 should suggest ###");
    });

    it("suggests correct level and title when document has numbered headings", () => {
      const lines = ["## 1. First", "### 1.1 Sub", "**New Subsection:**", "Content."];
      const errors = runRule(rule, lines, convertConfig);
      assert.strictEqual(errors.length, 1);
      const insertText = errors[0].fixInfo.insertText;
      assert.ok(insertText.startsWith("#### "), "should be #### (one below ###)");
      assert.ok(insertText.includes("New Subsection"), "title should be present");
    });

    it("suggests number prefix for first child under numbered parent (no sibling)", () => {
      const lines = ["# Doc", "## 1. Parent", "**First child:**", "Content."];
      const errors = runRule(rule, lines, convertConfig);
      assert.strictEqual(errors.length, 1);
      const insertText = errors[0].fixInfo.insertText;
      assert.ok(insertText.startsWith("### "), "should be ### (one below ##)");
      assert.ok(insertText.includes("1.1"), "should include prefix 1.1. or 1.1 (first child under 1.)");
      assert.ok(insertText.includes("First Child"), "title should be AP title-cased");
    });

    it("suggests no number prefix when section has no numbering", () => {
      const lines = ["## Section", "**Subsection:**", "Content."];
      const errors = runRule(rule, lines, convertConfig);
      assert.strictEqual(errors.length, 1);
      const insertText = errors[0].fixInfo.insertText;
      assert.ok(insertText.startsWith("### "), "should be ###");
      assert.ok(insertText.includes("Subsection") && !insertText.match(/\d+\./), "no number prefix");
    });

    it("insertText ends with \\n when heading-like line is followed by non-blank line (blank line after heading)", () => {
      const lines = ["## Section", "**Sub:**", "Next paragraph."];
      const errors = runRule(rule, lines, convertConfig);
      assert.strictEqual(errors.length, 1);
      assert.ok(errors[0].fixInfo.insertText.endsWith("\n"), "should add newline so one blank line before next content");
    });

    it("insertText does not end with \\n when followed by blank line", () => {
      const lines = ["## Section", "**Sub:**", ""];
      const errors = runRule(rule, lines, convertConfig);
      assert.strictEqual(errors.length, 1);
      assert.ok(!errors[0].fixInfo.insertText.endsWith("\n"), "no extra newline when next line blank");
    });

    it("insertText does not end with \\n at end of file", () => {
      const lines = ["## Section", "**Sub:**"];
      const errors = runRule(rule, lines, convertConfig);
      assert.strictEqual(errors.length, 1);
      assert.ok(!errors[0].fixInfo.insertText.endsWith("\n"), "no extra newline at EOF");
    });

    it("fixedHeadingLevel 4 suggests ####", () => {
      const lines = ["## Section", "**Sub:**"];
      const config = { "no-heading-like-lines": { convertToHeading: true, fixedHeadingLevel: 4 } };
      const errors = runRule(rule, lines, config);
      assert.strictEqual(errors.length, 1);
      assert.ok(errors[0].fixInfo.insertText.startsWith("#### "), "should start with ####");
    });

    it("AP title case: first/last capitalized", () => {
      const lines = ["**getting started:**", "Content."];
      const errors = runRule(rule, lines, convertConfig);
      assert.strictEqual(errors.length, 1);
      assert.ok(errors[0].fixInfo.insertText.includes("Getting Started"), "first and last word capitalized");
    });
  });

  describe("edge cases", () => {
    it("suggested level capped at 6 when last heading is ######", () => {
      const lines = ["###### Deep", "**Deeper:**"];
      const config = { "no-heading-like-lines": { convertToHeading: true } };
      const errors = runRule(rule, lines, config);
      assert.strictEqual(errors.length, 1);
      assert.ok(errors[0].fixInfo.insertText.startsWith("###### "), "level should be capped at 6");
    });

    it("fixedHeadingLevel 0 falls back to default level", () => {
      const lines = ["**Title:**", "Content."];
      const config = { "no-heading-like-lines": { convertToHeading: true, fixedHeadingLevel: 0 } };
      const errors = runRule(rule, lines, config);
      assert.strictEqual(errors.length, 1);
      assert.ok(errors[0].fixInfo.insertText.startsWith("## "), "invalid fixedHeadingLevel should fall back to ##");
    });

    it("fixedHeadingLevel 7 falls back to default level", () => {
      const lines = ["**Title:**", "Content."];
      const config = { "no-heading-like-lines": { convertToHeading: true, fixedHeadingLevel: 7 } };
      const errors = runRule(rule, lines, config);
      assert.strictEqual(errors.length, 1);
      assert.ok(errors[0].fixInfo.insertText.startsWith("## "), "fixedHeadingLevel > 6 should fall back");
    });

    it("reports **Text:** with leading and trailing spaces (trimmed before match)", () => {
      const lines = ["   **Summary:**   ", "Content."];
      const errors = runRule(rule, lines);
      assert.strictEqual(errors.length, 1);
      assert.strictEqual(errors[0].lineNumber, 1);
      assert.strictEqual(errors[0].fixInfo.insertText, "Summary");
    });

    it("bold colon only **:** does not match **.*:** (needs content)", () => {
      const lines = ["**:**", "Content."];
      const errors = runRule(rule, lines);
      assert.strictEqual(errors.length, 0);
    });
  });

  describe("optional dependencies (graceful degradation)", () => {
    it("rule works without heading-title-case and heading-numbering (stripEmphasis fix)", () => {
      const tmpDir = path.join(__dirname, "..", "..", "tmp-no-heading-like-lines-standalone");
      fs.mkdirSync(tmpDir, { recursive: true });
      try {
        fs.copyFileSync(path.join(RULES_DIR, "utils.js"), path.join(tmpDir, "utils.js"));
        fs.copyFileSync(
          path.join(RULES_DIR, "no-heading-like-lines.js"),
          path.join(tmpDir, "no-heading-like-lines.js")
        );
        const script = `
          const rule = require("./no-heading-like-lines.js");
          const errors = [];
          rule.function({ lines: ["**Hi:**", "content"], config: {} }, (e) => errors.push(e));
          console.log(JSON.stringify(errors.length > 0 ? errors[0].fixInfo : null));
        `;
        const result = spawnSync(
          process.execPath,
          ["-e", script],
          { cwd: tmpDir, encoding: "utf8", maxBuffer: 10 * 1024 }
        );
        assert.strictEqual(result.status, 0, result.stderr || result.error);
        const fixInfo = JSON.parse(result.stdout.trim());
        assert.ok(fixInfo, "should report one error with fixInfo");
        assert.strictEqual(fixInfo.insertText, "Hi", "stripEmphasis and trailing colon when optional deps missing");
      } finally {
        try {
          fs.rmSync(tmpDir, { recursive: true });
        } catch {
          // ignore
        }
      }
    });
  });
});
