"use strict";

/**
 * markdownlint rule: flag lines that look like headings but use bold/italic
 * (e.g. **Section:** or 1. **Item**) so they can be converted to proper ATX headings.
 *
 * @param {object} params - markdownlint params (lines, name, config)
 * @param {function(object): void} onError - Callback to report an error
 */
function ruleFunction(params, onError) {
  const lines = params.lines;

  // Patterns: [regex, description for error message]
  const patterns = [
    [/^\s*\*\*.*:\*\*\s*$/, "bold with colon inside (**Text:**)"],
    [/^\s*\*\*.*\*\*:\s*$/, "bold with colon outside (**Text**:)"],
    [/^\s*[0-9]+\.\s+\*\*.*\*\*\s*$/, "numbered list with bold (1. **Text**)"],
    [/^\s*\*.*:\*\s*$/, "italic with colon inside (*Text:*)"],
    [/^\s*\*.*\*:\s*$/, "italic with colon outside (*Text*:)"],
    [/^\s*[0-9]+\.\s+\*.*\*\s*$/, "numbered list with italic (1. *Text*)"],
  ];

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmedLine = line.trim();

    if (!trimmedLine) return;

    for (const [pattern, description] of patterns) {
      if (pattern.test(trimmedLine)) {
        onError({
          lineNumber,
          detail: `Line looks like ${description}; use an ATX heading (# Title) instead of heading-like formatting.`,
          context: line,
        });
        break;
      }
    }
  });
}

module.exports = {
  names: ["no-heading-like-lines"],
  description: "Disallow heading-like lines that should be proper headings",
  tags: ["headings"],
  function: ruleFunction,
};
