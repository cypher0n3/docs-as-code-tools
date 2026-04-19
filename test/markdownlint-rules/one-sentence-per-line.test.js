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

  describe("disable/enable block", () => {
    it("suppresses multi-sentence lines between disable and enable; reports after enable", () => {
      const lines = [
        "# Doc",
        "<!-- one-sentence-per-line disable -->",
        "First. Second.",
        "One. Two. Three.",
        "<!-- one-sentence-per-line enable -->",
        "Alpha. Beta.",
      ];
      const errors = runRule(rule, lines);
      assert.strictEqual(errors.length, 1, "only line after enable should error");
      assert.strictEqual(errors[0].lineNumber, 6);
    });

    it("disable only (no enable): all multi-sentence lines after disable are suppressed", () => {
      const lines = [
        "Single.",
        "<!-- one-sentence-per-line disable -->",
        "First. Second.",
        "A. B. C.",
      ];
      const errors = runRule(rule, lines);
      assert.strictEqual(errors.length, 0, "no errors when disable has no enable");
    });
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

  it("does not split on periods in identifiers (e.g. CYNAI.PROJCT.ProjectGitRepos)", () => {
    const lines = [
      "  - CYNAI.PROJCT.ProjectGitRepos: Model (many repos per project, uniqueness per project).",
    ];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0, "periods in identifier with no space after are not sentence boundaries");
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

  it("indented paragraph without explicit continuationIndent aligns continuation with line indent", () => {
    const lines = ["  First. Second."];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(
      errors[0].fixInfo.insertText,
      "\n  Second.",
      "default should match content indent (2), not fixed 4 spaces",
    );
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

  describe("getLineEndingState", () => {
    it("returns 'ended' for line ending with period", () => {
      assert.strictEqual(rule.getLineEndingState("This is a sentence."), "ended");
    });

    it("runs in bounded time on lines with long inline-code runs (no regex catastrophic backtracking)", () => {
      const line = "  Example: `" + " ".repeat(31) + "` on the previous line suppresses that heading's empty-section violation.";
      const start = Date.now();
      const state = rule.getLineEndingState(line);
      const elapsed = Date.now() - start;
      assert.strictEqual(state, "ended");
      assert.ok(elapsed < 50, `expected <50ms, took ${elapsed}ms`);
    });

    it("returns 'ended' for line ending with question mark", () => {
      assert.strictEqual(rule.getLineEndingState("Is this a sentence?"), "ended");
    });

    it("returns 'ended' for line ending with exclamation", () => {
      assert.strictEqual(rule.getLineEndingState("Wow this is a sentence!"), "ended");
    });

    it("returns 'open' for a word-ending line", () => {
      assert.strictEqual(rule.getLineEndingState("word ends the line here"), "open");
    });

    it("returns 'ended' for line ending with colon", () => {
      assert.strictEqual(rule.getLineEndingState("We require the following:"), "ended");
    });

    it("ignores content inside inline code when computing ending state", () => {
      assert.strictEqual(rule.getLineEndingState("Run `cmd.exe` now"), "open");
      assert.strictEqual(rule.getLineEndingState("Run `cmd.exe` now."), "ended");
    });

    it("returns 'open' after an e.g. abbreviation", () => {
      assert.strictEqual(rule.getLineEndingState("See examples e.g."), "open");
    });

    it("returns 'open' for empty or whitespace-only content", () => {
      assert.strictEqual(rule.getLineEndingState(""), "open");
      assert.strictEqual(rule.getLineEndingState("   "), "open");
    });

    it("returns 'open' for a line ending in ellipsis", () => {
      assert.strictEqual(rule.getLineEndingState("This is continuing..."), "open");
    });

    it("returns 'ended' for a line ending with a period after digits (sentence end)", () => {
      assert.strictEqual(rule.getLineEndingState("Use version 3.14."), "ended");
      assert.strictEqual(rule.getLineEndingState("Use version 1."), "ended");
    });

    it("uses default abbreviations when opts omitted", () => {
      assert.strictEqual(rule.getLineEndingState("See Dr."), "open");
    });

    it("allows strictAbbreviations override via opts", () => {
      assert.strictEqual(
        rule.getLineEndingState("No abbrev.", { abbreviations: new Set() }),
        "ended",
      );
    });

    it("returns 'open' when content is null or undefined", () => {
      assert.strictEqual(rule.getLineEndingState(null), "open");
      assert.strictEqual(rule.getLineEndingState(undefined), "open");
    });

    it("returns 'open' for a bare period", () => {
      assert.strictEqual(rule.getLineEndingState("."), "ended");
    });

    it("returns 'ended' for a line that is only an inline-style link", () => {
      assert.strictEqual(
        rule.getLineEndingState("[link text](https://example.com/path)"),
        "ended",
      );
    });

    it("returns 'ended' for a line of nested reference-style badges", () => {
      assert.strictEqual(
        rule.getLineEndingState("[![alt][badge-ref]][workflow-ref]"),
        "ended",
      );
    });

    it("returns 'ended' for multiple inline-style badges on one line", () => {
      const line = "[![CI](https://a.example/c.svg)](https://a.example/c) "
        + "[![L](https://a.example/l.svg)](https://a.example/l)";
      assert.strictEqual(rule.getLineEndingState(line), "ended");
    });

    it("returns 'open' for a line with prose followed by a link (no period)", () => {
      assert.strictEqual(
        rule.getLineEndingState("See the docs at [here](https://example.com)"),
        "open",
      );
    });

    it("returns 'ended' when sentence-ending punctuation is wrapped in bold", () => {
      assert.strictEqual(rule.getLineEndingState("**A sentence in bold.**"), "ended");
      assert.strictEqual(rule.getLineEndingState("1. **A sentence in bold.**"), "ended");
    });

    it("returns 'ended' when sentence-ending punctuation is wrapped in italics", () => {
      assert.strictEqual(rule.getLineEndingState("*An italic sentence.*"), "ended");
      assert.strictEqual(rule.getLineEndingState("_An underscored sentence._"), "ended");
    });

    it("returns 'ended' when sentence-ending punctuation is wrapped in strikethrough", () => {
      assert.strictEqual(rule.getLineEndingState("~~A struck sentence.~~"), "ended");
    });

    it("returns 'ended' for sentence ending with period followed by a trailing link", () => {
      assert.strictEqual(
        rule.getLineEndingState("See the docs. [here](https://example.com)"),
        "ended",
      );
    });

    it("returns 'open' when only emphasis markers wrap a non-ended phrase", () => {
      assert.strictEqual(rule.getLineEndingState("**an ongoing phrase**"), "open");
    });

    it("returns 'ended' for a line that is only an HTML anchor tag", () => {
      assert.strictEqual(rule.getLineEndingState("<a id=\"req-persna-0205\"></a>"), "ended");
    });

    it("returns 'ended' for a line that is only a void HTML tag", () => {
      assert.strictEqual(rule.getLineEndingState("<br />"), "ended");
      assert.strictEqual(rule.getLineEndingState("<img src=\"x.png\" alt=\"x\" />"), "ended");
    });

    it("returns 'ended' for a line that mixes link(s) and an HTML anchor", () => {
      assert.strictEqual(
        rule.getLineEndingState("[link](url) <a id=\"x\"></a>"),
        "ended",
      );
    });

    it("returns 'ended' for a sentence followed by a trailing HTML anchor", () => {
      assert.strictEqual(
        rule.getLineEndingState("This is prose. <a id=\"x\"></a>"),
        "ended",
      );
    });

    it("still classifies wrapped prose inside HTML tags by terminal punctuation", () => {
      assert.strictEqual(rule.getLineEndingState("<div>Actual prose.</div>"), "ended");
      assert.strictEqual(rule.getLineEndingState("<div>Actual prose</div>"), "open");
    });
  });

  describe("checkCrossLine", () => {
    const CROSS_ON = { "one-sentence-per-line": { checkCrossLine: true } };

    it("reports a wrap across two lines in a paragraph", () => {
      const lines = ["first part of the sentence", "keeps going here.", ""];
      const errors = runRule(rule, lines, CROSS_ON);
      assert.strictEqual(errors.length, 2);
      assert.strictEqual(errors[0].lineNumber, 1);
      assert.ok(errors[0].detail.includes("next line"));
      assert.strictEqual(errors[1].lineNumber, 2);
      assert.strictEqual(errors[1].fixInfo.deleteCount, -1);
    });

    it("does not report when checkCrossLine is false (default)", () => {
      const lines = ["first part of the sentence", "keeps going here.", ""];
      assert.strictEqual(runRule(rule, lines).length, 0);
      assert.strictEqual(runRule(rule, lines, { "one-sentence-per-line": { checkCrossLine: false } }).length, 0);
    });

    it("does not report across blank-line boundary", () => {
      const lines = ["first part", "", "Second part of text."];
      assert.strictEqual(runRule(rule, lines, CROSS_ON).length, 0);
    });

    it("does not report across ATX heading", () => {
      const lines = ["introductory text", "## Heading", "rest of text."];
      assert.strictEqual(runRule(rule, lines, CROSS_ON).length, 0);
    });

    it("does not report across fenced code fence", () => {
      const lines = [
        "introductory text",
        "```",
        "code line one",
        "```",
        "rest of text.",
      ];
      assert.strictEqual(runRule(rule, lines, CROSS_ON).length, 0);
    });

    it("does not report when current line ends with a colon", () => {
      const lines = ["We require the following:", "A list here."];
      assert.strictEqual(runRule(rule, lines, CROSS_ON).length, 0);
    });

    it("does not report across a new list-item marker", () => {
      const lines = [
        "- First item starts here",
        "- Second item starts here.",
      ];
      assert.strictEqual(runRule(rule, lines, CROSS_ON).length, 0);
    });

    it("does not report when a bold sentence ends on the previous line", () => {
      const lines = [
        "1. **A sentence in bold.**",
        "   Another sentence.",
      ];
      assert.strictEqual(runRule(rule, lines, CROSS_ON).length, 0);
    });

    it("does not report across an anchor-only line preceded by a link cluster", () => {
      const lines = [
        "- **REQ-PERSNA-0205:** Sentence content.",
        "  [CAI.PERSNA.SessionPersona](../tech_specs/personas.md#spec-cai-persna-sessionpersona)",
        "  [CAI.INFRNC.ModelSelection](../tech_specs/inference_backend.md#spec-cai-infrnc-modelselection)",
        "  <a id=\"req-persna-0205\"></a>",
        "  Description continues here.",
      ];
      assert.strictEqual(runRule(rule, lines, CROSS_ON).length, 0);
    });

    it("does not wrap an open prose line into a non-prose next line", () => {
      const lines = ["Open sentence", "[link](url)"];
      assert.strictEqual(runRule(rule, lines, CROSS_ON).length, 0);
    });

    describe("exceptionPatterns", () => {
      it("treats a line matching a user pattern (with matching pathGlob) as non-prose", () => {
        const lines = [
          "Open sentence",
          "SPEC-FOO-123",
          "Next prose line.",
        ];
        const cfg = {
          "one-sentence-per-line": {
            checkCrossLine: true,
            exceptionPatterns: [
              {
                pathGlobs: ["requirements/*.md"],
                linePatterns: ["^SPEC-[A-Z]+-[0-9]+$"],
              },
            ],
          },
        };
        assert.strictEqual(runRule(rule, lines, cfg, "requirements/foo.md").length, 0);
      });

      it("applies to all paths when pathGlobs is omitted", () => {
        const lines = ["Open sentence", "@@TOKEN@@"];
        const cfg = {
          "one-sentence-per-line": {
            checkCrossLine: true,
            exceptionPatterns: [
              { linePatterns: ["^@@[A-Z]+@@$"] },
            ],
          },
        };
        assert.strictEqual(runRule(rule, lines, cfg, "any/path.md").length, 0);
      });

      it("does not apply when pathGlobs do not match the file path", () => {
        const lines = ["Open sentence", "SPEC-FOO-123"];
        const cfg = {
          "one-sentence-per-line": {
            checkCrossLine: true,
            exceptionPatterns: [
              {
                pathGlobs: ["requirements/*.md"],
                linePatterns: ["^SPEC-[A-Z]+-[0-9]+$"],
              },
            ],
          },
        };
        const errors = runRule(rule, lines, cfg, "other/foo.md");
        assert.ok(errors.length >= 1, "pattern scoped to requirements/*.md must not apply elsewhere");
      });

      it("silently ignores invalid regex entries and still applies valid ones", () => {
        const lines = ["Open sentence", "SPEC-FOO-123"];
        const cfg = {
          "one-sentence-per-line": {
            checkCrossLine: true,
            exceptionPatterns: [
              {
                linePatterns: ["(unterminated", "^SPEC-[A-Z]+-[0-9]+$"],
              },
            ],
          },
        };
        assert.strictEqual(runRule(rule, lines, cfg, "any.md").length, 0);
      });

      it("exception on current line also suppresses wrap from that line", () => {
        const lines = [
          "SPEC-FOO-123",
          "Next prose line.",
        ];
        const cfg = {
          "one-sentence-per-line": {
            checkCrossLine: true,
            exceptionPatterns: [
              { linePatterns: ["^SPEC-[A-Z]+-[0-9]+$"] },
            ],
          },
        };
        assert.strictEqual(runRule(rule, lines, cfg, "any.md").length, 0);
      });

      it("accepts multiple entries and multiple patterns per entry", () => {
        const lines = [
          "Open sentence",
          "TAG-A",
          "TAG-B",
          "next prose line.",
        ];
        const cfg = {
          "one-sentence-per-line": {
            checkCrossLine: true,
            exceptionPatterns: [
              { linePatterns: ["^TAG-A$", "^TAG-B$"] },
            ],
          },
        };
        assert.strictEqual(runRule(rule, lines, cfg, "any.md").length, 0);
      });

      it("is ignored when not an array or contains malformed entries", () => {
        const lines = ["Open sentence", "more sentence here."];
        const cfg = {
          "one-sentence-per-line": {
            checkCrossLine: true,
            exceptionPatterns: "not-an-array",
          },
        };
        const errors = runRule(rule, lines, cfg, "any.md");
        assert.ok(errors.length >= 1, "malformed exceptionPatterns should not suppress real wraps");
      });
    });

    it("does not report when file path matches excludePathPatterns", () => {
      const lines = ["first part of the sentence", "keeps going here."];
      const cfg = {
        "one-sentence-per-line": {
          checkCrossLine: true,
          excludePathPatterns: ["**/README.md"],
        },
      };
      assert.strictEqual(runRule(rule, lines, cfg, "project/README.md").length, 0);
    });

    it("does not report when file length exceeds maxFileLinesForCrossLine", () => {
      const lines = [
        "first part of the sentence",
        "keeps going here.",
        "another",
        "line",
        "more",
        "content",
      ];
      const cfg = {
        "one-sentence-per-line": {
          checkCrossLine: true,
          maxFileLinesForCrossLine: 5,
        },
      };
      assert.strictEqual(runRule(rule, lines, cfg).length, 0);
    });

    describe("suppression", () => {
      it("line-scoped sub-check allow above wrapped line suppresses only cross-line", () => {
        const lines = [
          "<!-- one-sentence-per-line check_cross_line allow -->",
          "first part of the sentence",
          "keeps going here.",
        ];
        assert.strictEqual(runRule(rule, lines, CROSS_ON).length, 0);
      });

      it("block sub-check disable/enable suppresses cross-line within block", () => {
        const lines = [
          "<!-- one-sentence-per-line check_cross_line disable -->",
          "first part of the sentence",
          "keeps going here.",
          "<!-- one-sentence-per-line check_cross_line enable -->",
          "another open",
          "continues here.",
        ];
        const errors = runRule(rule, lines, CROSS_ON);
        assert.strictEqual(errors.length, 2);
        assert.strictEqual(errors[0].lineNumber, 5);
        assert.strictEqual(errors[1].lineNumber, 6);
        assert.strictEqual(errors[1].fixInfo.deleteCount, -1);
      });

      it("sub-check form does not suppress a multi-sentence-per-line violation", () => {
        const lines = [
          "<!-- one-sentence-per-line check_cross_line disable -->",
          "First. Second.",
          "<!-- one-sentence-per-line check_cross_line enable -->",
        ];
        const errors = runRule(rule, lines, CROSS_ON);
        assert.strictEqual(errors.length, 1);
        assert.strictEqual(errors[0].lineNumber, 2);
        assert.ok(errors[0].detail.includes("multiple sentences"));
      });

      it("whole-rule disable still suppresses both checks", () => {
        const lines = [
          "<!-- one-sentence-per-line disable -->",
          "First. Second.",
          "first part of the sentence",
          "keeps going here.",
          "<!-- one-sentence-per-line enable -->",
        ];
        assert.strictEqual(runRule(rule, lines, CROSS_ON).length, 0);
      });
    });

    it("still reports per-line multi-sentence when a large file skips cross-line", () => {
      const lines = [
        "Alpha. Beta.",
        "filler",
        "filler",
        "filler",
        "filler",
        "filler",
      ];
      const cfg = {
        "one-sentence-per-line": {
          checkCrossLine: true,
          maxFileLinesForCrossLine: 5,
        },
      };
      const errors = runRule(rule, lines, cfg);
      assert.strictEqual(errors.length, 1);
      assert.strictEqual(errors[0].lineNumber, 1);
    });

    describe("fixInfo", () => {
      it("primary fixInfo appends single-space + left-trimmed next-line content", () => {
        const lines = ["first part", "  keeps going."];
        const errors = runRule(rule, lines, CROSS_ON);
        assert.strictEqual(errors.length, 2);
        const primary = errors[0];
        assert.strictEqual(primary.lineNumber, 1);
        assert.ok(primary.fixInfo, "primary error has fixInfo");
        assert.strictEqual(primary.fixInfo.editColumn, lines[0].length + 1);
        assert.strictEqual(primary.fixInfo.insertText, " keeps going.");
        assert.strictEqual(primary.fixInfo.deleteCount, 0);
      });

      it("primary fixInfo trims trailing whitespace on current line", () => {
        const lines = ["first part   ", "keeps going."];
        const errors = runRule(rule, lines, CROSS_ON);
        const primary = errors[0];
        assert.ok(primary.fixInfo);
        assert.strictEqual(primary.fixInfo.editColumn, "first part".length + 1);
        assert.strictEqual(primary.fixInfo.deleteCount, 3);
        assert.strictEqual(primary.fixInfo.insertText, " keeps going.");
      });

      it("cleanup error has deleteCount -1 on the next line", () => {
        const lines = ["first part", "  keeps going."];
        const errors = runRule(rule, lines, CROSS_ON);
        const cleanup = errors[1];
        assert.strictEqual(cleanup.lineNumber, 2);
        assert.ok(cleanup.fixInfo);
        assert.strictEqual(cleanup.fixInfo.deleteCount, -1);
      });

      it("strips a 4-space continuation indent fully and inserts one space", () => {
        const lines = ["- First part", "    keeps going."];
        const errors = runRule(rule, lines, CROSS_ON);
        const primary = errors[0];
        assert.ok(primary.fixInfo);
        assert.strictEqual(primary.fixInfo.insertText, " keeps going.");
      });

      it("omits fixInfo when block exceeds maxBlockLinesForFix (reports primary only)", () => {
        const lines = ["first part", "keeps going here"];
        const cfg = {
          "one-sentence-per-line": {
            checkCrossLine: true,
            maxBlockLinesForFix: 1,
          },
        };
        const errors = runRule(rule, lines, cfg);
        assert.strictEqual(errors.length, 1);
        assert.strictEqual(errors[0].lineNumber, 1);
        assert.strictEqual(errors[0].fixInfo, undefined);
      });

      it("chained 3-line wrap: every wrap emits primary+cleanup with full-chain insertText", () => {
        const lines = ["alpha beta gamma", "delta epsilon", "zeta eta theta."];
        const errors = runRule(rule, lines, CROSS_ON);
        assert.strictEqual(errors.length, 4, "two wraps × (primary + cleanup)");

        const p1 = errors[0];
        assert.strictEqual(p1.lineNumber, 1);
        assert.ok(p1.fixInfo, "first wrap primary has fixInfo");
        assert.strictEqual(
          p1.fixInfo.insertText,
          " delta epsilon zeta eta theta.",
          "primary on line 1 carries the full downstream chain",
        );
        assert.strictEqual(p1.fixInfo.editColumn, lines[0].length + 1);

        const c1 = errors[1];
        assert.strictEqual(c1.lineNumber, 2);
        assert.strictEqual(c1.fixInfo.deleteCount, -1);

        const p2 = errors[2];
        assert.strictEqual(p2.lineNumber, 2);
        assert.ok(p2.fixInfo, "second wrap primary also has fixInfo");
        assert.strictEqual(
          p2.fixInfo.insertText,
          " zeta eta theta.",
          "primary on line 2 carries the chain from line 3 onward",
        );

        const c2 = errors[3];
        assert.strictEqual(c2.lineNumber, 3);
        assert.strictEqual(c2.fixInfo.deleteCount, -1);
      });
    });
  });

  describe("edge cases (sentence boundary)", () => {
    it("splits after bolded sentence and suggests break (fixInfo) after **...**", () => {
      const lines = ["**Important sentence.** Additional context. Other stuff"];
      const errors = runRule(rule, lines);
      assert.strictEqual(errors.length, 1);
      assert.ok(errors[0].fixInfo, "fixable rule should provide fixInfo");
      assert.ok(errors[0].fixInfo.insertText.includes("Additional context."), "insertText should break after bolded sentence");
      assert.ok(errors[0].fixInfo.insertText.includes("Other stuff"), "insertText should include third sentence");
    });

    it("splits when sentence ends with period then space then bold (.**Bolded text** rest)", () => {
      const lines = ["This is the first sentence. **Bolded text** rest of the sentence"];
      const errors = runRule(rule, lines);
      assert.strictEqual(errors.length, 1);
      assert.ok(errors[0].fixInfo);
      assert.ok(errors[0].fixInfo.insertText.includes("**Bolded text** rest of the sentence"));
    });

    it("splits when next sentence starts with inline code after period", () => {
      const lines = [
        "- **Streaming:** While `isAgentStreaming()` is true, plain Enter **queues** drafts (`queuedAutoSend`); slash/shell run immediately. `EnterBlockedWhileLoading` documents the matrix.",
      ];
      const errors = runRule(rule, lines);
      assert.strictEqual(errors.length, 1);
      assert.ok(errors[0].fixInfo.insertText.includes("`EnterBlockedWhileLoading` documents the matrix."));
    });

    it("does not split when no space after period (e.g. .**The or word.Word)", () => {
      const lines = ["- **No command or path allowlists inside the container.**The sandbox agent runs in an already-sandboxed environment (the container)."];
      const errors = runRule(rule, lines);
      assert.strictEqual(errors.length, 0, "period with no space after (.**The) is not a sentence boundary");
    });

    it("does not split on Dr. abbreviation (Dr in default list)", () => {
      const lines = ["See Dr. Smith for details."];
      const errors = runRule(rule, lines);
      assert.strictEqual(errors.length, 0);
    });

    it("does not split on ellipsis within a single sentence", () => {
      const lines = ["Inference connectivity configuration... supplied by the orchestrator in the **PMA managed service start bundle**."];
      const errors = runRule(rule, lines);
      assert.strictEqual(errors.length, 0, "ellipsis in middle of sentence should not trigger");
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

    it("does not split when period is followed only by trailing space (no next word)", () => {
      const lines = ["First. "];
      const errors = runRule(rule, lines);
      assert.strictEqual(errors.length, 0, "trailing space after period with no second sentence");
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
