"use strict";

const js = require("@eslint/js");
const globals = require("globals");
const { defineConfig } = require("eslint/config");
const eslintPluginSecurity = require("eslint-plugin-security");

module.exports = defineConfig([
  {
    name: "docs-as-code-tools/markdownlint-rules",
    files: ["markdownlint-rules/**/*.js"],
    plugins: { js, security: eslintPluginSecurity },
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
      "security/detect-eval-with-expression": "warn",
      "security/detect-non-literal-require": "warn",
      "security/detect-child-process": "warn",
      "security/detect-non-literal-fs-filename": "warn",
      "security/detect-new-buffer": "warn",
      "security/detect-buffer-noassert": "warn",
      "security/detect-disable-mustache-escape": "warn",
      "security/detect-no-csrf-before-method-override": "warn",
      "security/detect-possible-timing-attacks": "warn",
      "security/detect-pseudoRandomBytes": "warn",
      "security/detect-bidi-characters": "warn",
      "security/detect-non-literal-regexp": "warn",
      "security/detect-object-injection": "off",
      "security/detect-unsafe-regex": "off",
    },
  },
]);
