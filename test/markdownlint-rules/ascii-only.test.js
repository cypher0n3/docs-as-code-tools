"use strict";

/**
 * Unit tests for ascii-only: disallow non-ASCII characters except in paths
 * matching allowedPathPatternsUnicode (or allowedPathPatternsEmoji for
 * emoji-only). The rule is path-aware, so we pass a fake file name (name)
 * when invoking it.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert");
const rule = require("../../markdownlint-rules/ascii-only.js");
const { runRule } = require("./run-rule.js");

describe("ascii-only", () => {
  it("reports no errors for ASCII-only content", () => {
    const lines = ["# Title", "Plain ASCII text."];
    const errors = runRule(rule, lines, {}, "doc.md");
    assert.strictEqual(errors.length, 0);
  });

  it("skips when file path matches excludePathPatterns", () => {
    const lines = ["Café"];
    const config = { excludePathPatterns: ["**/excluded.md"] };
    const errors = runRule(rule, lines, config, "path/excluded.md");
    assert.strictEqual(errors.length, 0);
  });

  it("reports error for non-ASCII when path not allowlisted", () => {
    // Arrow → is not in default allowed set; reported when path is not in allowlist.
    const lines = ["Use arrow \u2192 here"];
    const errors = runRule(rule, lines, {}, "doc.md");
    assert.ok(errors.length >= 1);
    assert.ok(errors.some((e) => e.detail.includes("ASCII") || e.detail.includes("U+")));
    const withRange = errors.find((e) => Array.isArray(e.range) && e.range.length === 2);
    assert.ok(withRange, "at least one error should include range [column, length] for the violating character");
    assert.ok(withRange.detail.includes("U+") || withRange.detail.includes("'"), "detail should identify the character or code point");
  });

  it("reports no errors when path matches allowedPathPatternsUnicode", () => {
    // Glob "*.md" matches "doc.md"; non-ASCII is allowed in that file.
    const lines = ["Café"];
    const errors = runRule(rule, lines, {
      allowedPathPatternsUnicode: ["*.md"],
    }, "doc.md");
    assert.strictEqual(errors.length, 0);
  });

  it("reports error with emoji-list message when path is emoji-only and char not in list", () => {
    const lines = ["Arrow \u2192 here"];
    const errors = runRule(rule, lines, {
      allowedPathPatternsEmoji: ["*.md"],
      allowedEmoji: ["\u263A"],
    }, "doc.md");
    assert.ok(errors.length >= 1);
    assert.ok(errors.some((e) => e.detail.includes("not in allowed emoji") || e.detail.includes("U+")), "detail should mention emoji list or code point");
  });

  it("allows non-ASCII when path matches relative pattern (utils matchGlob **/ branch)", () => {
    const lines = ["Café"];
    const errors = runRule(rule, lines, {
      allowedPathPatternsUnicode: ["foo.md"],
    }, "sub/foo.md");
    assert.strictEqual(errors.length, 0);
  });

  it("reports error when path does not match any unicode pattern (utils pathMatchesAny)", () => {
    const lines = ["Arrow \u2192"];
    const errors = runRule(rule, lines, {
      allowedPathPatternsUnicode: ["other.md"],
    }, "doc.md");
    assert.ok(errors.length >= 1);
  });

  it("skips content inside ~~~ fenced block (utils iterateNonFencedLines)", () => {
    const lines = ["~~~", "Café inside tildes", "~~~", "Plain"];
    const errors = runRule(rule, lines, {}, "doc.md");
    assert.strictEqual(errors.length, 0);
  });

  it("skips content inside ``` fenced code block (ignore unicode in code blocks)", () => {
    const lines = ["```", "Café and 😀 inside backtick fence", "```", "Plain"];
    const errors = runRule(rule, lines, {}, "doc.md");
    assert.strictEqual(errors.length, 0);
  });

  it("allowUnicodeInCodeBlocks: false reports unicode inside fenced block", () => {
    const lines = ["```", "Arrow \u2192 inside fence", "```"];
    const errors = runRule(rule, lines, { allowUnicodeInCodeBlocks: false }, "doc.md");
    assert.ok(errors.length >= 1);
    assert.ok(errors.some((e) => e.lineNumber === 2 && (e.detail.includes("U+2192") || e.detail.includes("→"))));
  });

  it("allowUnicodeInCodeBlocks: false with disallowUnicodeInCodeBlockTypes: [\"text\"] reports in ```text only", () => {
    const lines = [
      "```text",
      "Unicode \u2192 here",
      "```",
      "```go",
      "Unicode \u2192 here",
      "```",
    ];
    const errors = runRule(rule, lines, {
      allowUnicodeInCodeBlocks: false,
      disallowUnicodeInCodeBlockTypes: ["text"],
    }, "doc.md");
    assert.ok(errors.length >= 1, "should report in ```text block");
    assert.ok(errors.some((e) => e.lineNumber === 2), "error on line 2 (text block)");
    const goBlockErrors = errors.filter((e) => e.lineNumber === 5);
    assert.strictEqual(goBlockErrors.length, 0, "no errors in ```go block when only text is in disallow list");
  });

  it("disallowUnicodeInCodeBlockTypes: [] with allowUnicodeInCodeBlocks false checks all blocks", () => {
    const lines = ["```go", "Arrow \u2192", "```"];
    const errors = runRule(rule, lines, {
      allowUnicodeInCodeBlocks: false,
      disallowUnicodeInCodeBlockTypes: [],
    }, "doc.md");
    assert.ok(errors.length >= 1);
  });

  it("reports no errors when unicode is only inside single backticks", () => {
    const lines = ["Use `café` or `naïve` in code."];
    const errors = runRule(rule, lines, {}, "doc.md");
    assert.strictEqual(errors.length, 0);
  });

  it("reports no errors when emoji is only inside backticks", () => {
    const lines = ["Run `echo 😀` for a smile."];
    const errors = runRule(rule, lines, {}, "doc.md");
    assert.strictEqual(errors.length, 0);
  });

  it("reports error for unicode outside backticks but not for inside", () => {
    const lines = ["Arrow \u2192 has `\u2192` in code."];
    const errors = runRule(rule, lines, {}, "doc.md");
    assert.ok(errors.length >= 1, "should report arrow outside backticks");
    assert.ok(errors.some((e) => e.detail.includes("U+2192") || e.detail.includes("→")), "detail should mention the character");
  });

  it("reports no errors when path is emoji-only and content has only allowed emoji", () => {
    const lines = ["Hello \u263A"]; // ☺ in allowed list
    const errors = runRule(rule, lines, {
      allowedPathPatternsEmoji: ["*.md"],
      allowedEmoji: ["\u263A"],
    }, "doc.md");
    assert.strictEqual(errors.length, 0);
  });

  it("reports no errors when path is emoji-only and content has emoji plus variation selector", () => {
    const lines = ["\u263A\uFE00"]; // ☺ + variation selector
    const errors = runRule(rule, lines, {
      allowedPathPatternsEmoji: ["*.md"],
      allowedEmoji: ["\u263A"],
    }, "doc.md");
    assert.strictEqual(errors.length, 0);
  });

  it("reports no errors for default-allowed letters (é, ï) without config", () => {
    const lines = ["Café and naïve"];
    const errors = runRule(rule, lines, {}, "doc.md");
    assert.strictEqual(errors.length, 0);
  });

  it("reports no errors when non-ASCII char is in config allowedUnicode (extends default)", () => {
    const lines = ["\u0144"]; // ń not in default set
    const errors = runRule(rule, lines, {
      allowedUnicode: ["\u0144"],
    }, "doc.md");
    assert.strictEqual(errors.length, 0);
  });

  it("reports no errors when multiple chars from config allowedUnicode (config file style)", () => {
    const lines = ["Polish: \u0144 and \u0142"]; // ń, ł not in default
    const errors = runRule(rule, lines, {
      allowedUnicode: ["\u0144", "\u0142"],
    }, "doc.md");
    assert.strictEqual(errors.length, 0);
  });

  it("reports no errors when line has both default-allowed and config allowedUnicode", () => {
    const lines = ["Café and Zdu\u0144"]; // é default, ń from config
    const errors = runRule(rule, lines, {
      allowedUnicode: ["\u0144"],
    }, "doc.md");
    assert.strictEqual(errors.length, 0);
  });

  it("reports error for char not in default and not in config allowedUnicode", () => {
    const lines = ["\u0144"]; // ń
    const errors = runRule(rule, lines, {}, "doc.md");
    assert.ok(errors.length >= 1);
    assert.ok(errors.some((e) => e.detail.includes("U+0144") || e.detail.includes("ń")));
  });

  it("reports error when config allowedUnicode omits a char used in line", () => {
    const lines = ["\u0144 and \u0142"]; // ń allowed by config, ł not
    const errors = runRule(rule, lines, {
      allowedUnicode: ["\u0144"],
    }, "doc.md");
    assert.ok(errors.length >= 1);
    assert.ok(errors.some((e) => e.detail.includes("U+0142") || e.detail.includes("ł")));
  });

  it("allowedUnicodeReplaceDefault: true uses only config list (no default set)", () => {
    const lines = ["Café and \u2192"]; // é in default, → not; with replace, only → in list
    const errors = runRule(rule, lines, {
      allowedUnicode: ["\u2192"],
      allowedUnicodeReplaceDefault: true,
    }, "doc.md");
    assert.ok(errors.length >= 1, "é should be reported when default is replaced");
    assert.ok(errors.some((e) => e.detail.includes("U+00E9") || e.detail.includes("é")));
    assert.ok(!errors.some((e) => e.detail.includes("U+2192")), "→ should be allowed by config list");
  });

  it("allowedUnicodeReplaceDefault: false (default) extends default set", () => {
    const lines = ["Café and \u0144"];
    const errors = runRule(rule, lines, {
      allowedUnicode: ["\u0144"],
      allowedUnicodeReplaceDefault: false,
    }, "doc.md");
    assert.strictEqual(errors.length, 0);
  });

  it("includes suggested replacement when unicodeReplacements is object", () => {
    const lines = ["Arrow \u2192"];
    const errors = runRule(rule, lines, {
      unicodeReplacements: { "\u2192": "->" },
    }, "doc.md");
    assert.ok(errors.length >= 1);
    assert.ok(errors.some((e) => e.detail.includes("suggested replacement") && e.detail.includes("->")));
  });

  it("includes suggested replacement when unicodeReplacements is array", () => {
    const lines = ["Arrow \u2192"];
    const errors = runRule(rule, lines, {
      unicodeReplacements: [["\u2192", "->"]],
    }, "doc.md");
    assert.ok(errors.length >= 1);
    assert.ok(errors.some((e) => e.detail.includes("suggested replacement")));
  });

  it("formats astral character with 6-digit code point in error", () => {
    const lines = ["\u{1F600}"]; // 😀
    const errors = runRule(rule, lines, {}, "doc.md");
    assert.ok(errors.length >= 1);
    assert.ok(errors.some((e) => /U\+[0-9A-F]{6}/.test(e.detail)), "astral code point should be 6 hex digits");
  });

  it("strips inline code before checking (utils stripInlineCode fence match)", () => {
    const lines = ["Arrow \u2192 ``code``"];
    const errors = runRule(rule, lines, {}, "doc.md");
    assert.ok(errors.length >= 1);
    assert.ok(errors.some((e) => e.detail.includes("U+2192") || e.detail.includes("→")));
  });

  it("skips non-string entries in path patterns (utils pathMatchesAny)", () => {
    const lines = ["Café"];
    const errors = runRule(rule, lines, {
      allowedPathPatternsUnicode: ["*.md", 123],
    }, "doc.md");
    assert.strictEqual(errors.length, 0);
  });

  it("handles empty pattern in path list (utils matchGlob)", () => {
    const lines = ["Café"];
    const errors = runRule(rule, lines, {
      allowedPathPatternsUnicode: ["", "*.md"],
    }, "doc.md");
    assert.strictEqual(errors.length, 0);
  });

  it("uses default replacements when unicodeReplacements is falsy (buildReplacementsMap early return)", () => {
    const lines = ["Arrow \u2192"];
    const errors = runRule(rule, lines, {
      unicodeReplacements: "",
    }, "doc.md");
    assert.ok(errors.length >= 1);
  });

  describe("fixInfo (auto-fix)", () => {
    it("reports fixInfo when unicodeReplacements provides a replacement", () => {
      const lines = ["Arrow \u2192 here"];
      const errors = runRule(rule, lines, {
        unicodeReplacements: { "\u2192": "->" },
      }, "doc.md");
      const arrowError = errors.find((e) => e.detail && (e.detail.includes("U+2192") || e.detail.includes("→")));
      assert.ok(arrowError, "error for arrow should be reported");
      assert.ok(arrowError.fixInfo, "fixable error should include fixInfo when replacement is configured");
      assert.strictEqual(typeof arrowError.fixInfo.editColumn, "number");
      assert.strictEqual(typeof arrowError.fixInfo.deleteCount, "number");
      assert.strictEqual(arrowError.fixInfo.insertText, "->", "insertText should be the configured replacement");
    });

    it("does not report fixInfo when no replacement is configured", () => {
      const lines = ["Arrow \u2192"];
      const errors = runRule(rule, lines, { unicodeReplacements: {} }, "doc.md");
      assert.ok(errors.length >= 1);
      assert.ok(!errors[0].fixInfo, "error should not have fixInfo when unicodeReplacements has no replacement for the character");
    });
  });
});
