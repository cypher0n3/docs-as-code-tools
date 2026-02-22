"use strict";

/**
 * Unit tests for heading-title-case: enforce AP-style headline capitalization
 * (first/last/subphrase-start capitalized; minor words lowercase in middle;
 * hyphenated segments and first word after colon checked). Words in backticks
 * are ignored; lowercase words are configurable.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert");
const rule = require("../../markdownlint-rules/heading-title-case.js");
const { runRule } = require("./run-rule.js");

describe("heading-title-case", () => {
  it("reports no errors for valid title case", () => {
    // AP style: "is" and "a" lowercase in middle; first/last capitalized
    const lines = ["# This is a Valid Title", "## Another Good Heading"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("skips when file path matches excludePathPatterns", () => {
    const lines = ["# all lowercase wrong"];
    const config = { excludePathPatterns: ["**/excluded.md"] };
    const errors = runRule(rule, lines, config, "path/excluded.md");
    assert.strictEqual(errors.length, 0);
  });

  it("skips when file path matches excludePathPatterns (rule-level config)", () => {
    const lines = ["# all wrong"];
    const config = { "heading-title-case": { excludePathPatterns: ["**"] } };
    const errors = runRule(rule, lines, config, "any.md");
    assert.strictEqual(errors.length, 0);
  });

  it("reports filename error and skips title-case error for same word (continue branch)", () => {
    const lines = ["# readme.md"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].detail.includes("backticks") || errors[0].detail.includes("File name"));
  });

  it("reports error when middle word should be lowercase", () => {
    // Default lowercase list includes "is" and "and"; "Is" and "And" in the middle are invalid.
    const lines = ["# This Is And Valid"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 2, "both 'Is' and 'And' should be reported");
    assert.strictEqual(errors[0].lineNumber, 1);
    assert.strictEqual(errors[1].lineNumber, 1);
    const details = errors.map((e) => e.detail);
    assert.ok(details.some((d) => d.includes("Is") && d.includes("lowercase")), "one error for 'Is'");
    assert.ok(details.some((d) => d.includes("And") && d.includes("lowercase")), "one error for 'And'");
    assert.ok(Array.isArray(errors[0].range) && errors[0].range.length === 2, "error should include range [column, length] for the violating word");
  });

  it("allows lowercase in the middle when lowercaseWords extends default", () => {
    // Config extends default: "through" added; "and" already in default. First/last ("Use", "Other") stay capped.
    const lines = ["# Use through and Other"];
    const errors = runRule(rule, lines, {
      "heading-title-case": { lowercaseWords: ["through"] },
    });
    assert.strictEqual(errors.length, 0);
  });

  it("lowercaseWordsReplaceDefault: true uses only config list", () => {
    const lines = ["# This And That"];
    const errors = runRule(rule, lines, {
      "heading-title-case": { lowercaseWords: ["and"], lowercaseWordsReplaceDefault: true },
    });
    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].detail.includes("And") && errors[0].detail.includes("lowercase"));
  });

  it("lowercaseWordsReplaceDefault: false (default) merges config with default", () => {
    const lines = ["# Use through and Other"];
    const errors = runRule(rule, lines, {
      "heading-title-case": { lowercaseWords: ["through"], lowercaseWordsReplaceDefault: false },
    });
    assert.strictEqual(errors.length, 0);
  });

  it("reports error with range pointing to the violating word", () => {
    const lines = ["# The Cat And the Hat"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1, "only 'And' reported ('the' is already lowercase)");
    assert.strictEqual(errors[0].lineNumber, 1);
    assert.ok(Array.isArray(errors[0].range) && errors[0].range.length === 2);
    const [col, len] = errors[0].range;
    assert.strictEqual(len, 3, "range length should match word 'And'");
    const line = lines[0];
    const wordAtRange = line.slice(col - 1, col - 1 + len);
    assert.strictEqual(wordAtRange, "And", "range should highlight the violating word");
  });

  it("reports first-word violation with expected case in detail", () => {
    const lines = ["## getting started"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 2, "both 'getting' (first) and 'started' (last) should be capitalized");
    const details = errors.map((e) => e.detail);
    assert.ok(details.some((d) => d.includes("getting") && (d.includes("capitalized") || d.includes("first"))));
    assert.ok(details.some((d) => d.includes("started") && (d.includes("capitalized") || d.includes("last"))));
  });

  it("reports last-word violation with expected case in detail", () => {
    const lines = ["## Using Tools in practice"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1, "only 'practice' reported ('in' is already lowercase)");
    assert.ok(errors[0].detail.includes("practice"));
    assert.ok(errors[0].detail.includes("capitalized") || errors[0].detail.includes("last"));
  });

  it("accepts valid hyphenated compounds (AP: each segment capitalized)", () => {
    const lines = ["# One-Stop Shop", "## How to Do a Follow-Up"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports error for lowercase segment in hyphenated word", () => {
    const lines = ["# One-stop Shop"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].detail.includes("stop") && errors[0].detail.includes("capitalized"));
  });

  it("capitalizes first word after colon (AP subphrase start)", () => {
    const lines = ["## Summary: The Results"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports error when first word after colon is lowercase", () => {
    const lines = ["## Summary: the Results"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].detail.includes("the") && errors[0].detail.includes("capitalized"));
  });

  it("allows single letter after 'Phase' as phase label (e.g. Phase A, Phase B)", () => {
    const lines = ["### Phase A: Fixable Rules and Scripts (One-Time)"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0, "Phase A should not be flagged; single letter after 'Phase' is a label");
  });

  it("allows single letter after other label-parent words (Step B, Appendix A, Type A)", () => {
    const lines = ["## Step B: Do Something", "## Appendix A: References", "## Type A and Type B"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0, "single letter after Step/Appendix/Type is a label");
  });

  it("reports no errors for heading that is only inline code (words.length === 0)", () => {
    const lines = ["## `code only`"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports no errors for heading containing HTML entity (e.g. &rArr;), not flagged as lowercase", () => {
    const lines = ["## Step A &rArr; Step B"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0, "&rArr; should be ignored for title-case (ASCII-safe special char)");
  });

  it("reports no errors for word with bracket prefix (firstAlphaIdx > 0)", () => {
    const lines = ["## (Optional) Section Title"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports no errors for hyphenated word with punctuation-only segment (skip non-alpha segment)", () => {
    const lines = ["## Test---Here"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports error for hyphenated word with range on segment (segmentOffset/segmentLength)", () => {
    const lines = ["# One-stop Shop"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.ok(Array.isArray(errors[0].range) && errors[0].range.length === 2);
    assert.strictEqual(errors[0].range[1], 4, "range length should be segment 'stop'");
  });

  it("allows capitalized first segment of hyphenated compound when that word is in lowercase list (e.g. Per-Section)", () => {
    const lines = ["## Heading With Per-Section in Name"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  describe("fixInfo (auto-fix)", () => {
    it("reports fixInfo with editColumn, deleteCount, insertText for middle-word lowercase violation", () => {
      const lines = ["# The Cat And the Hat"];
      const errors = runRule(rule, lines);
      const andError = errors.find((e) => e.detail && e.detail.includes("And"));
      assert.ok(andError, "error for 'And' should be reported");
      assert.ok(andError.fixInfo, "fixable error should include fixInfo");
      assert.strictEqual(typeof andError.fixInfo.editColumn, "number");
      assert.strictEqual(typeof andError.fixInfo.deleteCount, "number");
      assert.strictEqual(typeof andError.fixInfo.insertText, "string");
      assert.strictEqual(andError.fixInfo.insertText, "and", "insertText should correct 'And' to lowercase 'and'");
    });

    it("reports fixInfo with insertText capitalizing last word", () => {
      const lines = ["## Using Tools in practice"];
      const errors = runRule(rule, lines);
      const practiceError = errors.find((e) => e.detail && e.detail.includes("practice"));
      assert.ok(practiceError, "error for 'practice' should be reported");
      assert.ok(practiceError.fixInfo);
      assert.strictEqual(practiceError.fixInfo.insertText, "Practice", "insertText should capitalize 'practice' to 'Practice'");
    });

    it("reports fixInfo with insertText capitalizing first word", () => {
      const lines = ["## getting started"];
      const errors = runRule(rule, lines);
      const gettingError = errors.find((e) => e.detail && e.detail.includes("getting"));
      assert.ok(gettingError, "error for 'getting' should be reported");
      assert.ok(gettingError.fixInfo);
      assert.strictEqual(gettingError.fixInfo.insertText, "Getting", "insertText should capitalize 'getting' to 'Getting'");
    });

    it("reports fixInfo for hyphenated segment (correct segment only)", () => {
      const lines = ["# One-stop Shop"];
      const errors = runRule(rule, lines);
      assert.strictEqual(errors.length, 1);
      assert.ok(errors[0].fixInfo);
      assert.strictEqual(errors[0].fixInfo.insertText, "Stop", "insertText should capitalize segment 'stop' to 'Stop'");
    });

    it("suggests backticks for file name instead of case change", () => {
      const lines = ["## See README.md for more"];
      const errors = runRule(rule, lines);
      const fileError = errors.find((e) => e.detail && e.detail.includes("backticks"));
      assert.ok(fileError, "should report file name should be in backticks");
      assert.ok(fileError.fixInfo);
      assert.strictEqual(fileError.fixInfo.insertText, "`README.md`");
      assert.ok(fileError.detail.includes("README.md"));
    });

    it("suggests backticks for Makefile (no extension)", () => {
      const lines = ["## Edit the Makefile"];
      const errors = runRule(rule, lines);
      const fileError = errors.find((e) => e.detail && e.detail.includes("backticks"));
      assert.ok(fileError);
      assert.strictEqual(fileError.fixInfo.insertText, "`Makefile`");
    });

    it("does not treat numbering like 1.2 or 0.1 as file name", () => {
      const lines = ["#### 1.3 Skip 1.2 (Expected 1.2)"];
      const errors = runRule(rule, lines);
      const backtickErrors = errors.filter((e) => e.detail && e.detail.includes("backticks"));
      assert.strictEqual(backtickErrors.length, 0, "numbering segments 1.2 etc. should not trigger file-name backticks");
    });

    it("skips punctuation-only token when checking for filename (core empty)", () => {
      const lines = ["## See README.md ... and more"];
      const errors = runRule(rule, lines);
      const backtickErrors = errors.filter((e) => e.detail && e.detail.includes("backticks"));
      assert.strictEqual(backtickErrors.length, 1, "only README.md gets backticks; ... is skipped");
      assert.strictEqual(backtickErrors[0].fixInfo.insertText, "`README.md`");
    });

    it("suggests backticks for filenames with leading/trailing punctuation (e.g. in parens)", () => {
      const line = "### `security/detect-non-literal-regexp` (utils.js, allow-custom-anchors.js)";
      const lines = [line];
      const errors = runRule(rule, lines);
      const backtickErrors = errors.filter((e) => e.detail && e.detail.includes("backticks"));
      assert.strictEqual(backtickErrors.length, 2, "utils.js and allow-custom-anchors.js should get backtick suggestion");
      const utilsFix = backtickErrors.find((e) => e.fixInfo.insertText.includes("utils.js"));
      const anchorsFix = backtickErrors.find((e) => e.fixInfo.insertText.includes("allow-custom-anchors.js"));
      assert.ok(utilsFix, "utils.js fix present");
      assert.strictEqual(utilsFix.fixInfo.insertText, "(`utils.js`,", "preserve leading ( and trailing ,");
      assert.ok(anchorsFix, "allow-custom-anchors.js fix present");
      assert.strictEqual(anchorsFix.fixInfo.insertText, "`allow-custom-anchors.js`)", "preserve trailing )");
    });

    it("fixInfo targets correct word when heading has backticks and parentheses (inline code)", () => {
      const line = "## Python: `# noqa: E402` (module level import not at top of file)";
      const lines = [line];
      const errors = runRule(rule, lines);
      assert.ok(errors.length >= 1, "should report at least one title-case error");
      const moduleError = errors.find((e) => e.fixInfo && e.fixInfo.insertText === "(Module");
      assert.ok(moduleError, "should report fix for '(module' -> '(Module' (subphrase start after paren)");
      assert.strictEqual(moduleError.fixInfo.editColumn, 27, "editColumn must point to '(' in '(module' (after ## Python: `# noqa: E402` )");
      assert.strictEqual(moduleError.fixInfo.deleteCount, 7);
      const wordInLine = line.slice(moduleError.fixInfo.editColumn - 1, moduleError.fixInfo.editColumn - 1 + moduleError.fixInfo.deleteCount);
      assert.strictEqual(wordInLine, "(module", "range must span the word (module");
    });
  });

  describe("applyTitleCase (export)", () => {
    it("handles hyphenated word with punctuation-only segment (coverage)", () => {
      assert.strictEqual(typeof rule.applyTitleCase, "function");
      const result = rule.applyTitleCase("Test---Here");
      assert.strictEqual(result, "Test---Here", "punctuation-only segments preserved");
    });

    it("accepts lowercaseWords as Set (coverage)", () => {
      const result = rule.applyTitleCase("use and through", {
        lowercaseWords: new Set(["and", "through"]),
      });
      assert.strictEqual(result, "Use and Through");
    });

    it("lowercaseWordsReplaceDefault: true uses only config list (coverage)", () => {
      const result = rule.applyTitleCase("a and the b", {
        lowercaseWords: ["and", "the"],
        lowercaseWordsReplaceDefault: true,
      });
      assert.strictEqual(result, "A and the B");
    });

    it("preserves single letter after 'Phase' as phase label", () => {
      const result = rule.applyTitleCase("Phase A: Fixable Rules and Scripts (One-Time)");
      assert.strictEqual(result, "Phase A: Fixable Rules and Scripts (One-Time)", "Phase A label stays capitalized");
    });

    it("preserves single letter after other label-parent words (Step A, Appendix A)", () => {
      assert.strictEqual(rule.applyTitleCase("Step A: Setup"), "Step A: Setup");
      assert.strictEqual(rule.applyTitleCase("Appendix A: Glossary"), "Appendix A: Glossary");
    });

    it("returns empty or whitespace as-is (words.length === 0 branch)", () => {
      assert.strictEqual(rule.applyTitleCase(""), "");
      assert.strictEqual(rule.applyTitleCase("   "), "   ");
      assert.strictEqual(
        rule.applyTitleCase("Use `# noqa: E402` here"),
        "Use `# noqa: E402` Here",
        "inline code (backticks) must be preserved; surrounding words get title case"
      );
    });
  });

  it("runs with config undefined (branch coverage)", () => {
    const lines = ["# Valid Title Here"];
    const errors = runRule(rule, lines, undefined);
    assert.strictEqual(errors.length, 0);
  });

  describe("edge cases (applyTitleCase export)", () => {
    it("applyTitleCase with empty string returns empty string", () => {
      assert.strictEqual(rule.applyTitleCase(""), "");
    });

    it("applyTitleCase with null or undefined (edge case: may throw or return)", () => {
      try {
        const rNull = rule.applyTitleCase(null);
        assert.ok(rNull === null || typeof rNull === "string", "null input: return null or string");
      } catch (err) {
        assert.ok(err instanceof Error, "null input may throw in current implementation");
      }
      try {
        const rUndef = rule.applyTitleCase(undefined);
        assert.ok(rUndef === undefined || typeof rUndef === "string", "undefined input: return undefined or string");
      } catch (err) {
        assert.ok(err instanceof Error, "undefined input may throw in current implementation");
      }
    });

    it("heading with only numbers and symbols has no title-case violation", () => {
      const lines = ["## 1.2.3"];
      const errors = runRule(rule, lines);
      assert.strictEqual(errors.length, 0);
    });
  });
});
