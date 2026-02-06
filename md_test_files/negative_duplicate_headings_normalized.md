# Negative Fixture: Duplicate Headings (Normalized)

Expect: `no-duplicate-headings-normalized` (same title after stripping numbering/normalization).

## 1. Introduction

First occurrence.

## 1. Introduction

Duplicate; normalized title matches first.

## 2. Overview

Different title is fine.

## 2.  OVERVIEW

Same as "2. Overview" after normalizing case and whitespace.

```markdownlint-expect
{
  "total": 6,
  "errors": [
    { "line": 9, "rule": "heading-numbering" },
    { "line": 9, "rule": "MD024/no-duplicate-heading" },
    { "line": 9, "rule": "no-duplicate-headings-normalized" },
    { "line": 13, "rule": "heading-numbering" },
    { "line": 17, "rule": "heading-numbering" },
    { "line": 17, "rule": "no-duplicate-headings-normalized" }
  ]
}
```
