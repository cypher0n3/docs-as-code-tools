"use strict";

const js = require("@eslint/js");
const globals = require("globals");
const { defineConfig } = require("eslint/config");

module.exports = defineConfig([
  {
    name: "docs-as-code-tools/markdownlint-rules",
    files: [".markdownlint-rules/**/*.js"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: { ...globals.node },
    },
    rules: {
      "max-lines": ["warn", { max: 250, skipBlankLines: true, skipComments: true }],
      complexity: ["warn", { max: 10 }],
      "max-depth": ["warn", 4],
      "max-params": ["warn", 4],
    },
  },
]);
