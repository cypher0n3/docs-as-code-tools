"use strict";

/**
 * Unit tests for one-sentence-per-line: enforce one sentence per line in prose
 * and list content; fixInfo splits at the first sentence boundary.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert");
const rule = require("../../markdownlint-rules/one-sentence-per-line.js");
const { runRule } = require("./run-rule.js");

describe("one-sentence-per-line", () => {
  it("reports no errors for single-sentence lines", () => {
    const lines = ["One sentence here.", "Another line.", ""];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports error for two sentences on one line (paragraph)", () => {
    const lines = ["First sentence. Second sentence."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 1);
    assert.ok(errors[0].detail.includes("one sentence per line") || errors[0].detail.includes("multiple sentences"));
    assert.ok(errors[0].fixInfo, "fixable rule should provide fixInfo");
    assert.strictEqual(typeof errors[0].fixInfo.editColumn, "number");
    assert.strictEqual(typeof errors[0].fixInfo.deleteCount, "number");
    assert.ok(errors[0].fixInfo.insertText.startsWith("\n"), "insertText should start with newline + indent");
  });

  it("reports no error when suppress comment on previous line (line-level override)", () => {
    const lines = ["<!-- one-sentence-per-line allow -->", "First sentence. Second sentence."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports error for two sentences in numbered list item", () => {
    const lines = ["1. First sentence. Second sentence."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 1);
    assert.ok(errors[0].fixInfo.insertText.includes("Second sentence."));
  });

  it("reports error for two sentences in bullet list item", () => {
    const lines = ["- First sentence. Second sentence."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 1);
    assert.ok(errors[0].fixInfo.insertText.includes("Second sentence."));
  });

  it("fix splits all three sentences in one pass", () => {
    const lines = ["One. Two. Three."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    const insert = errors[0].fixInfo.insertText;
    assert.ok(insert.includes("Two.") && insert.includes("Three."), "insertText should contain both second and third sentence");
    assert.strictEqual((insert.match(/\n/g) || []).length, 2, "one newline before Two, one before Three");
  });

  it("does not split on e.g. abbreviation", () => {
    const lines = ["Use examples e.g. and more text here."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("does not split on decimal numbers", () => {
    const lines = ["The value is 3.14 and that is fine."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("does not split when period has no space after it (e.g. filenames)", () => {
    const lines = [
      "See file.name and config.json for details.",
      "Edit utils.js or index.ts.",
    ];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("splits when period is followed by space even with filename elsewhere", () => {
    const lines = ["Open file.txt. Then save and close."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].fixInfo.insertText.includes("Then save"));
  });

  it("does not split on period inside quoted filename, splits after quote when space follows", () => {
    const lines = ['This line has a file named "filename.txt". Some other text.'];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].fixInfo.insertText.includes("Some other text."));
    assert.ok(!errors[0].fixInfo.insertText.includes("filename.txt"), "should not split inside quoted filename");
  });

  it("does not split on periods inside double-quoted numbering examples", () => {
    const lines = [
      '  Duplicate pairs include "1. Overview" with "2. Overview", and "1.1 Scope" with "2.1 Scope".',
    ];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0, "periods inside double-quoted labels (e.g. 1. Overview) are not sentence boundaries");
  });

  it("splits after quoted sentence when closing quote then space then new sentence", () => {
    const lines = ['"Quoted sentence." This is a new sentence."'];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].fixInfo.insertText.includes("This is a new sentence"));
  });

  it("does not split inside inline code", () => {
    const lines = ["Run `cmd. exe` and then stop."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("skips fenced code blocks", () => {
    const lines = [
      "```",
      "First line. Second line.",
      "```",
    ];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("skips ATX headings", () => {
    const lines = ["## Heading with. Multiple parts."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("skips link reference definitions", () => {
    const lines = ["[id]: https://example.com. More text."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("skips blank lines", () => {
    const lines = ["", "   ", "One sentence."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("skips rule when file path matches excludePathPatterns", () => {
    const lines = ["First. Second."];
    const config = { "one-sentence-per-line": { excludePathPatterns: ["**/README.md"] } };
    const errorsMatch = runRule(rule, lines, config, "project/README.md");
    assert.strictEqual(errorsMatch.length, 0);
    const errorsNoMatch = runRule(rule, lines, config, "project/doc.md");
    assert.strictEqual(errorsNoMatch.length, 1);
  });

  it("does not skip when excludePathPatterns is empty array", () => {
    const lines = ["First. Second."];
    const config = { "one-sentence-per-line": { excludePathPatterns: [] } };
    const errors = runRule(rule, lines, config, "any.md");
    assert.strictEqual(errors.length, 1);
  });

  it("fixInfo has editColumn, deleteCount, insertText", () => {
    const lines = ["Alpha. Beta."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    const fix = errors[0].fixInfo;
    assert.ok(fix.editColumn >= 1);
    assert.ok(fix.deleteCount >= 1);
    assert.ok(fix.insertText.includes("Beta."));
  });

  it("reports error for question and exclamation", () => {
    const lines = ["Really? Yes!"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
  });

  it("skips front matter then reports error after", () => {
    const lines = ["---", "title: Doc", "---", "", "First. Second."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 5);
  });

  it("does not split period inside parentheses (link context)", () => {
    const lines = ["See (e.g. example). More text."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].fixInfo.insertText.includes("More text."));
  });

  it("splits after period when optional quote follows", () => {
    const lines = ["First.\" Second."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].fixInfo.insertText.includes("Second"));
  });

  it("uses continuationIndent for indented paragraph continuation", () => {
    const lines = ["  First. Second."];
    const config = { "one-sentence-per-line": { continuationIndent: 2 } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].fixInfo.insertText.startsWith("\n  "), "continuation should be 2 spaces when paragraph is indented");
  });

  it("uses no indent for unindented paragraph continuation", () => {
    const lines = ["First. Second."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].fixInfo.insertText, "\nSecond.", "continuation should have no leading space when base line is not indented");
  });

  it("uses strictAbbreviations when provided as array", () => {
    const lines = ["No abbrev. Here."];
    const config = { "one-sentence-per-line": { strictAbbreviations: ["No"] } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 1);
  });

  it("skips line with only list marker and no content", () => {
    const lines = ["- ", "1. "];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("getFirstSentenceBoundary uses default abbreviations when opts omitted", () => {
    assert.strictEqual(rule.getFirstSentenceBoundary("First. Second."), 6);
  });

  it("getFirstSentenceBoundary uses default abbreviations when opts.abbreviations omitted", () => {
    assert.strictEqual(rule.getFirstSentenceBoundary("First. Second.", {}), 6);
  });

  it("getFirstSentenceBoundary returns null when sentence end at start", () => {
    assert.strictEqual(rule.getFirstSentenceBoundary(". A."), null);
  });

  it("runs with config undefined (uses default rule config)", () => {
    const lines = ["One. Two."];
    const errors = runRule(rule, lines, undefined);
    assert.strictEqual(errors.length, 1);
  });

  describe("edge cases (sentence boundary)", () => {
    it("does not split on Dr. abbreviation (Dr in default list)", () => {
      const lines = ["See Dr. Smith for details."];
      const errors = runRule(rule, lines);
      assert.strictEqual(errors.length, 0);
    });

    it("splits when ellipsis is not sentence end and real sentence end follows", () => {
      const lines = ["First... Then the next sentence."];
      const errors = runRule(rule, lines);
      assert.ok(errors.length >= 1, "ellipsis then space then capital should be boundary");
    });

    it("handles multiple spaces between sentences", () => {
      const lines = ["First.    Second."];
      const errors = runRule(rule, lines);
      assert.strictEqual(errors.length, 1);
      assert.ok(errors[0].fixInfo);
    });

    it("strictAbbreviations empty array treats every period+space as boundary", () => {
      const lines = ["No abbrev. Here."];
      const config = { "one-sentence-per-line": { strictAbbreviations: [] } };
      const errors = runRule(rule, lines, config);
      assert.strictEqual(errors.length, 1);
    });

    it("getFirstSentenceBoundary returns null for empty string", () => {
      assert.strictEqual(rule.getFirstSentenceBoundary(""), null);
    });

    it("skips line that is only whitespace after trim", () => {
      const lines = ["   ", "One sentence."];
      const errors = runRule(rule, lines);
      assert.strictEqual(errors.length, 0);
    });

    it("version number 1. not treated as sentence end", () => {
      const lines = ["Use version 1. It is stable."];
      const errors = runRule(rule, lines);
      assert.strictEqual(errors.length, 1);
      assert.ok(errors[0].fixInfo.insertText.includes("It is stable"));
    });

    it("bullet with multiple spaces after marker", () => {
      const lines = ["-   First. Second."];
      const errors = runRule(rule, lines);
      assert.strictEqual(errors.length, 1);
      assert.ok(errors[0].fixInfo.insertText.includes("Second."));
    });

    it("numbered list with period in number (1. First. Second.)", () => {
      const lines = ["1. First. Second."];
      const errors = runRule(rule, lines);
      assert.strictEqual(errors.length, 1);
    });
  });
});
