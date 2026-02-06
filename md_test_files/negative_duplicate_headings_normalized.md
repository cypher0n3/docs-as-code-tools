# Negative Fixture: Duplicate Headings (Normalized)

Expect: `no-duplicate-headings-normalized` (same title after stripping numbering/normalization).

```markdownlint-expect
{
  "total": 6,
  "errors": [
    { "line": 23, "rule": "heading-numbering" },
    { "line": 23, "rule": "MD024/no-duplicate-heading" },
    { "line": 23, "rule": "no-duplicate-headings-normalized" },
    { "line": 27, "rule": "heading-numbering" },
    { "line": 31, "rule": "heading-numbering" },
    { "line": 31, "rule": "no-duplicate-headings-normalized" }
  ]
}
```

## 1. Introduction

First occurrence.

## 1. Introduction

Duplicate; normalized title matches first.

## 2. Overview

Different title is fine.

## 2.  OVERVIEW

Same as "2. Overview" after normalizing case and whitespace.
