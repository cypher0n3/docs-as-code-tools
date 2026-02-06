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

  // Patterns to match heading-like lines:
    // 1. **Text:** - bold with colon inside (^\*\*.*:\*\*$)
    // 2. **Text**: - bold with colon outside (^\*\*.*\*\*:$)
    // 3. 1. **Text** - numbered list with bold (^[0-9]+\. \*\*.*\*\*$)
    // 4. Similar patterns with single asterisks for italic
    const patterns = [
      /^\s*\*\*.*:\*\*\s*$/,               // **Text:** (colon inside)
      /^\s*\*\*.*\*\*:\s*$/,               // **Text**: (colon outside)
      /^\s*[0-9]+\.\s+\*\*.*\*\*\s*$/,     // 1. **Text** (numbered list)
      /^\s*\*.*:\*\s*$/,                   // *Text:* (italic with colon inside)
      /^\s*\*.*\*:\s*$/,                   // *Text*: (italic with colon outside)
      /^\s*[0-9]+\.\s+\*.*\*\s*$/,         // 1. *Text* (numbered list with italic)
    ];

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmedLine = line.trim();

      // Skip empty lines
      if (!trimmedLine) {
        return;
      }

      // Check if line matches any heading-like pattern
      for (const pattern of patterns) {
        if (pattern.test(trimmedLine)) {
          onError({
            lineNumber: lineNumber,
            detail: "Use proper Markdown headings instead of heading-like lines",
            context: line,
          });
          break; // Only report once per line
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
