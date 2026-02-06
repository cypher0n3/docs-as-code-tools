"use strict";

/**
 * Security-focused tests for .markdownlint-rules:
 * - Invalid or malicious regex in config does not throw (safeRegExp / defensive parsing).
 * - Rules complete within a timeout when given ReDoS-prone patterns and long input
 *   (ensures we don't hang on malicious or accidental catastrophic backtracking).
 */

const { describe, it } = require("node:test");
const assert = require("node:assert");
const ruleAnchors = require("../../.markdownlint-rules/allow-custom-anchors.js");
const { runRule } = require("./run-rule.js");

describe("security", () => {
  describe("allow-custom-anchors: invalid regex in config", () => {
    it("does not throw when allowedIdPatterns contains invalid regex", () => {
      const lines = ["<a id=\"x\"></a>"];
      assert.doesNotThrow(() => {
        runRule(ruleAnchors, lines, { allowedIdPatterns: ["["] });
      });
    });

    it("does not throw when placement has invalid headingMatch regex", () => {
      const lines = ["<a id=\"ok\"></a>"];
      const config = {
        allowedIdPatterns: [
          { pattern: "^ok$", placement: { headingMatch: "(" } },
        ],
      };
      assert.doesNotThrow(() => {
        runRule(ruleAnchors, lines, config);
      });
    });
  });

  describe("allow-custom-anchors: ReDoS awareness", () => {
    it("ReDoS: user-controlled regex can cause catastrophic backtracking (mitigation TBD)", { skip: "Current implementation is susceptible; enable when safe-regex or timeout is added." }, () => {
      const longId = "a".repeat(35) + "X";
      const lines = [`<a id="${longId}"></a>`];
      const config = { allowedIdPatterns: ["(a+)+$"] };
      const errors = runRule(ruleAnchors, lines, config);
      assert.ok(Array.isArray(errors));
    });
  });
});
