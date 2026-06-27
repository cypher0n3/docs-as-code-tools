"use strict";

/**
 * Unit tests for utils.js helpers used by custom rules (e.g. isRuleSuppressedByComment).
 */

const path = require("node:path");
const { describe, it } = require("node:test");
const assert = require("node:assert");
const {
  compileExceptionPatterns,
  isRuleSuppressedByComment,
  isSubCheckSuppressedByComment,
  iterateProseBlocks,
  lineMatchesException,
  matchGlob,
  parseHeadingNumberPrefix,
  pathMatchesAny,
} = require("../../markdownlint-rules/utils.js");

describe("utils", () => {
  describe("parseHeadingNumberPrefix", () => {
    it("does not parse bare four-or-more-digit headings as numbering", () => {
      const cases = [
        "1000 Overview",
        "2110 to 2180: The Pattern Break",
        "12345 Campaign Era",
        "2750 and After: The Default Campaign Era",
      ];

      for (const text of cases) {
        assert.deepStrictEqual(parseHeadingNumberPrefix(text), {
          numbering: null,
          hasH2Dot: false,
          titleText: text,
        });
      }
    });

    it("still parses shorter bare numeric outline prefixes", () => {
      assert.deepStrictEqual(parseHeadingNumberPrefix("999 Release Notes"), {
        numbering: "999",
        hasH2Dot: false,
        titleText: "Release Notes",
      });
    });

    it("still parses explicit large numeric outline prefixes", () => {
      assert.deepStrictEqual(
        parseHeadingNumberPrefix("2024. Release Notes"),
        {
          numbering: "2024",
          hasH2Dot: true,
          titleText: "Release Notes",
        },
      );
      assert.deepStrictEqual(
        parseHeadingNumberPrefix("2024.1 Release Notes"),
        {
          numbering: "2024.1",
          hasH2Dot: false,
          titleText: "Release Notes",
        },
      );
      assert.deepStrictEqual(
        parseHeadingNumberPrefix("2024.1. Release Notes"),
        {
          numbering: "2024.1",
          hasH2Dot: true,
          titleText: "Release Notes",
        },
      );
    });
  });

  describe("matchGlob", () => {
    it("matches bare filename only at path root (single segment)", () => {
      assert.strictEqual(matchGlob("README.md", "README.md"), true);
      assert.strictEqual(matchGlob("docs/README.md", "README.md"), false);
      assert.strictEqual(matchGlob("docs/README.md", "**/README.md"), true);
    });

    it("matches *.md only at root segment", () => {
      assert.strictEqual(matchGlob("doc.md", "*.md"), true);
      assert.strictEqual(matchGlob("sub/doc.md", "*.md"), false);
      assert.strictEqual(matchGlob("sub/doc.md", "**/*.md"), true);
    });

    it("matches root basename when path is absolute (markdownlint passes full path)", () => {
      const rootReadme = path.join(process.cwd(), "README.md");
      const nestedReadme = path.join(process.cwd(), "docs", "README.md");
      assert.strictEqual(matchGlob(rootReadme, "README.md"), true);
      assert.strictEqual(matchGlob(nestedReadme, "README.md"), false);
    });

    it("normalizes relative paths with .. before matching (docs/../README.md)", () => {
      assert.strictEqual(matchGlob("docs/../README.md", "README.md"), true);
      assert.strictEqual(matchGlob("docs/../other/README.md", "README.md"), false);
    });

    it("matches one .. segment relative to cwd (../README.md from a subdir)", () => {
      const parentReadme = path.resolve(process.cwd(), "..", "README.md");
      assert.strictEqual(matchGlob(parentReadme, "README.md"), true);
      assert.strictEqual(matchGlob(path.resolve(process.cwd(), "..", "other", "README.md"), "README.md"), false);
    });

    it("matches multi-segment patterns against absolute paths (cli2 passes abs names)", () => {
      const absDefaults = path.join(process.cwd(), "defaults", "foo.md");
      assert.strictEqual(matchGlob(absDefaults, "defaults/*.md"), true);
      assert.strictEqual(matchGlob(absDefaults, "defaults/**"), true);
      assert.strictEqual(matchGlob(absDefaults, "defaults/foo.md"), true);
      const absOther = path.join(process.cwd(), "other", "foo.md");
      assert.strictEqual(matchGlob(absOther, "defaults/*.md"), false);
    });

    it("rejects multi-segment patterns for abs paths outside cwd", () => {
      const outside = path.resolve(process.cwd(), "..", "elsewhere", "defaults", "foo.md");
      assert.strictEqual(matchGlob(outside, "defaults/*.md"), false);
    });
  });

  describe("pathMatchesAny", () => {
    it("returns false when no pattern matches", () => {
      assert.strictEqual(pathMatchesAny("a/b.md", ["x.md"]), false);
    });

    it("returns true when any pattern matches", () => {
      assert.strictEqual(pathMatchesAny("README.md", ["other.md", "README.md"]), true);
    });
  });

  describe("compileExceptionPatterns / lineMatchesException", () => {
    it("returns [] for non-array input", () => {
      assert.deepStrictEqual(compileExceptionPatterns(null), []);
      assert.deepStrictEqual(compileExceptionPatterns("nope"), []);
    });

    it("skips entries without linePatterns array", () => {
      const compiled = compileExceptionPatterns([{}, { linePatterns: "x" }, null]);
      assert.deepStrictEqual(compiled, []);
    });

    it("silently drops invalid regexes but keeps valid ones", () => {
      const compiled = compileExceptionPatterns([
        { linePatterns: ["(bad", "^ok$"] },
      ]);
      assert.strictEqual(compiled.length, 1);
      assert.strictEqual(compiled[0].regexes.length, 1);
    });

    it("lineMatchesException returns false when no compiled entries", () => {
      assert.strictEqual(lineMatchesException("x", "any.md", []), false);
      assert.strictEqual(lineMatchesException("x", "any.md", null), false);
    });

    it("lineMatchesException honors pathGlobs scope", () => {
      const compiled = compileExceptionPatterns([
        { pathGlobs: ["requirements/*.md"], linePatterns: ["^SPEC-\\d+$"] },
      ]);
      assert.strictEqual(lineMatchesException("SPEC-1", "requirements/a.md", compiled), true);
      assert.strictEqual(lineMatchesException("SPEC-1", "other/a.md", compiled), false);
    });

    it("lineMatchesException applies to all paths when pathGlobs is omitted", () => {
      const compiled = compileExceptionPatterns([{ linePatterns: ["^TOKEN$"] }]);
      assert.strictEqual(lineMatchesException("TOKEN", "any/path.md", compiled), true);
    });
  });

  describe("isRuleSuppressedByComment", () => {
    it("returns true when previous line is solely the suppress comment", () => {
      const lines = ["<!-- no-empty-heading allow -->", "## Empty", "## Next"];
      assert.strictEqual(isRuleSuppressedByComment(lines, 2, "no-empty-heading"), true);
    });

    it("returns true when suppress comment is separated by blank lines from the line", () => {
      const lines = ["<!-- no-h1-content allow -->", "", "", "Intro paragraph.", "## Next"];
      assert.strictEqual(isRuleSuppressedByComment(lines, 4, "no-h1-content"), true);
    });

    it("returns false when a non-blank line between target and suppress is not the comment", () => {
      const lines = ["<!-- no-h1-content allow -->", "- [TOC](#toc)", "", "Prose.", "## Next"];
      assert.strictEqual(isRuleSuppressedByComment(lines, 4, "no-h1-content"), false);
    });

    it("returns true when current line ends with the suppress comment", () => {
      const lines = ["## Empty section <!-- no-empty-heading allow -->", "## Next"];
      assert.strictEqual(isRuleSuppressedByComment(lines, 1, "no-empty-heading"), true);
    });

    it("returns true with optional whitespace in comment (previous line)", () => {
      const lines = ["  <!--   ascii-only   allow   -->  ", "Café"];
      assert.strictEqual(isRuleSuppressedByComment(lines, 2, "ascii-only"), true);
    });

    it("returns false when wrong rule name in comment (previous line)", () => {
      const lines = ["<!-- ascii-only allow -->", "## Single"];
      assert.strictEqual(isRuleSuppressedByComment(lines, 2, "heading-min-words"), false);
    });

    it("returns false when no comment present", () => {
      const lines = ["## Empty", "## Next"];
      assert.strictEqual(isRuleSuppressedByComment(lines, 1, "no-empty-heading"), false);
    });

    it("returns false when lineNumber is 1 and no comment on line 1", () => {
      const lines = ["## First heading"];
      assert.strictEqual(isRuleSuppressedByComment(lines, 1, "no-empty-heading"), false);
    });

    it("returns true when lineNumber is 1 and line 1 is only the comment", () => {
      const lines = ["<!-- document-length allow -->", "second line"];
      assert.strictEqual(isRuleSuppressedByComment(lines, 1, "document-length"), true);
    });

    it("returns false for invalid inputs (null lines, out of range)", () => {
      assert.strictEqual(isRuleSuppressedByComment(null, 1, "x"), false);
      assert.strictEqual(isRuleSuppressedByComment([], 1, "x"), false);
      assert.strictEqual(isRuleSuppressedByComment(["a"], 0, "x"), false);
      assert.strictEqual(isRuleSuppressedByComment(["a"], 2, "x"), false);
      assert.strictEqual(isRuleSuppressedByComment(["a"], 1, ""), false);
      assert.strictEqual(isRuleSuppressedByComment(["a"], 1, null), false);
    });

    it("returns false when current line is undefined (e.g. sparse array)", () => {
      const lines = Array(3);
      lines[0] = "first";
      lines[2] = "third";
      assert.strictEqual(isRuleSuppressedByComment(lines, 2, "x"), false);
    });

    it("returns true when line ends with markdownlint-cleared comment form (dots)", () => {
      const lines = ["Use arrow → here. <!-- .......... ..... -->"];
      assert.strictEqual(isRuleSuppressedByComment(lines, 1, "ascii-only"), true);
    });

    it("returns true when line is inside disable block (between disable and enable)", () => {
      const lines = [
        "<!-- no-empty-heading disable -->",
        "## 1. Empty Heading 1",
        "",
        "## 2. Empty Heading 2",
        "",
        "## 3. Empty Heading 3",
        "<!-- no-empty-heading enable -->",
        "",
        "## 4. Empty Heading 4",
      ];
      assert.strictEqual(isRuleSuppressedByComment(lines, 2, "no-empty-heading"), true);
      assert.strictEqual(isRuleSuppressedByComment(lines, 4, "no-empty-heading"), true);
      assert.strictEqual(isRuleSuppressedByComment(lines, 6, "no-empty-heading"), true);
      assert.strictEqual(isRuleSuppressedByComment(lines, 9, "no-empty-heading"), false);
    });

    it("returns false when enable turns rule back on (line after enable is not suppressed)", () => {
      const lines = [
        "<!-- no-empty-heading disable -->",
        "## Empty",
        "<!-- no-empty-heading enable -->",
        "## Empty Again",
      ];
      assert.strictEqual(isRuleSuppressedByComment(lines, 2, "no-empty-heading"), true);
      assert.strictEqual(isRuleSuppressedByComment(lines, 4, "no-empty-heading"), false);
    });

    it("returns true when disable has no matching enable (rest of file suppressed)", () => {
      const lines = [
        "## OK",
        "Content.",
        "<!-- no-empty-heading disable -->",
        "## Empty",
        "## Also Empty",
      ];
      assert.strictEqual(isRuleSuppressedByComment(lines, 1, "no-empty-heading"), false);
      assert.strictEqual(isRuleSuppressedByComment(lines, 4, "no-empty-heading"), true);
      assert.strictEqual(isRuleSuppressedByComment(lines, 5, "no-empty-heading"), true);
    });

    it("disable/enable: wrong rule name in comment does not affect state", () => {
      const lines = [
        "<!-- no-empty-heading disable -->",
        "## Empty",
        "<!-- other-rule enable -->",
        "## Still Empty",
      ];
      assert.strictEqual(isRuleSuppressedByComment(lines, 2, "no-empty-heading"), true);
      assert.strictEqual(isRuleSuppressedByComment(lines, 4, "no-empty-heading"), true);
    });

    it("disable/enable: allow optional whitespace in comment", () => {
      const lines = ["  <!--  no-empty-heading  disable  -->  ", "## Empty"];
      assert.strictEqual(isRuleSuppressedByComment(lines, 2, "no-empty-heading"), true);
    });

    it("disable only (no enable): ascii-only stays suppressed for rest of file", () => {
      const lines = [
        "ASCII line.",
        "<!-- ascii-only disable -->",
        "Use → here.",
        "And café here.",
      ];
      assert.strictEqual(isRuleSuppressedByComment(lines, 1, "ascii-only"), false);
      assert.strictEqual(isRuleSuppressedByComment(lines, 3, "ascii-only"), true);
      assert.strictEqual(isRuleSuppressedByComment(lines, 4, "ascii-only"), true);
    });
  });

  describe("isSubCheckSuppressedByComment", () => {
    const RULE = "one-sentence-per-line";
    const SUB = "check_cross_line";

    it("returns true when previous line is the sub-check allow comment", () => {
      const lines = [`<!-- ${RULE} ${SUB} allow -->`, "first line"];
      assert.strictEqual(isSubCheckSuppressedByComment(lines, 2, RULE, SUB), true);
    });

    it("returns true when line is inside a sub-check disable/enable block", () => {
      const lines = [
        `<!-- ${RULE} ${SUB} disable -->`,
        "a",
        "b",
        `<!-- ${RULE} ${SUB} enable -->`,
        "c",
      ];
      assert.strictEqual(isSubCheckSuppressedByComment(lines, 2, RULE, SUB), true);
      assert.strictEqual(isSubCheckSuppressedByComment(lines, 3, RULE, SUB), true);
      assert.strictEqual(isSubCheckSuppressedByComment(lines, 5, RULE, SUB), false);
    });

    it("returns false when sub-check token differs", () => {
      const lines = [`<!-- ${RULE} other_check disable -->`, "a"];
      assert.strictEqual(isSubCheckSuppressedByComment(lines, 2, RULE, SUB), false);
    });

    it("returns false for invalid inputs", () => {
      assert.strictEqual(isSubCheckSuppressedByComment(null, 1, RULE, SUB), false);
      assert.strictEqual(isSubCheckSuppressedByComment(["a"], 0, RULE, SUB), false);
      assert.strictEqual(isSubCheckSuppressedByComment(["a"], 1, "", SUB), false);
      assert.strictEqual(isSubCheckSuppressedByComment(["a"], 1, RULE, ""), false);
    });

    it("returns true when current line ends with sub-check allow comment", () => {
      const lines = [`hello text <!-- ${RULE} ${SUB} allow -->`];
      assert.strictEqual(isSubCheckSuppressedByComment(lines, 1, RULE, SUB), true);
    });
  });

  describe("iterateProseBlocks", () => {
    it("groups consecutive prose lines into one block", () => {
      const lines = [
        "First line.",
        "Second line.",
        "Third line.",
      ];
      const blocks = Array.from(iterateProseBlocks(lines)).map((b) =>
        b.map(({ lineNumber, line }) => ({ lineNumber, line })),
      );
      assert.strictEqual(blocks.length, 1);
      assert.deepStrictEqual(blocks[0], [
        { lineNumber: 1, line: "First line." },
        { lineNumber: 2, line: "Second line." },
        { lineNumber: 3, line: "Third line." },
      ]);
    });

    it("splits at blank lines", () => {
      const lines = [
        "Block one line one.",
        "Block one line two.",
        "",
        "Block two line one.",
        "Block two line two.",
      ];
      const blocks = Array.from(iterateProseBlocks(lines));
      assert.strictEqual(blocks.length, 2);
      assert.strictEqual(blocks[0].length, 2);
      assert.strictEqual(blocks[0][0].lineNumber, 1);
      assert.strictEqual(blocks[0][1].lineNumber, 2);
      assert.strictEqual(blocks[1].length, 2);
      assert.strictEqual(blocks[1][0].lineNumber, 4);
      assert.strictEqual(blocks[1][1].lineNumber, 5);
    });

    it("splits at ATX heading", () => {
      const lines = [
        "Line one.",
        "Line two.",
        "## Heading",
        "Line four.",
      ];
      const blocks = Array.from(iterateProseBlocks(lines));
      assert.strictEqual(blocks.length, 2);
      assert.strictEqual(blocks[0].length, 2);
      assert.strictEqual(blocks[1].length, 1);
      assert.strictEqual(blocks[1][0].lineNumber, 4);
    });

    it("excludes fenced code fences and their content", () => {
      const lines = [
        "Before fence.",
        "```",
        "Inside fence one.",
        "Inside fence two.",
        "```",
        "After fence.",
      ];
      const blocks = Array.from(iterateProseBlocks(lines));
      assert.strictEqual(blocks.length, 2);
      assert.strictEqual(blocks[0][0].line, "Before fence.");
      assert.strictEqual(blocks[0][0].lineNumber, 1);
      assert.strictEqual(blocks[1][0].line, "After fence.");
      assert.strictEqual(blocks[1][0].lineNumber, 6);
    });

    it("preserves absolute line numbers", () => {
      const lines = [
        "",
        "",
        "Line three.",
        "Line four.",
      ];
      const blocks = Array.from(iterateProseBlocks(lines));
      assert.strictEqual(blocks.length, 1);
      assert.strictEqual(blocks[0][0].lineNumber, 3);
      assert.strictEqual(blocks[0][1].lineNumber, 4);
    });

    it("breaks a block at a multi-line HTML comment", () => {
      const lines = [
        "Line one.",
        "<!--",
        "  comment body",
        "-->",
        "Line five.",
      ];
      const blocks = Array.from(iterateProseBlocks(lines));
      assert.strictEqual(blocks.length, 2);
      assert.strictEqual(blocks[0][0].line, "Line one.");
      assert.strictEqual(blocks[1][0].line, "Line five.");
      assert.strictEqual(blocks[1][0].lineNumber, 5);
    });

    it("ignores single-line HTML comments (still yields them as prose)", () => {
      const lines = [
        "Before comment.",
        "<!-- single-line comment -->",
        "After comment.",
      ];
      const blocks = Array.from(iterateProseBlocks(lines));
      assert.strictEqual(blocks.length, 1);
      assert.strictEqual(blocks[0].length, 3);
    });
  });
});
