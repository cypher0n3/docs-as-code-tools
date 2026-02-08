# Negative Fixture: Heading Title Case

<!-- Lint: `npx markdownlint-cli2 md_test_files/negative_heading_title_case.md` -->
<!-- Expect: `heading-title-case` (first word lowercase; middle "and" capitalized; last word lowercase). -->

## getting started

Lowercase first word.

## The Cat And the Hat

Middle "and" should be lowercase.

## Using Tools in practice

Last word "practice" should be capitalized; "in" should be lowercase.

## Using Tools (in Practice)

This should fail: first word inside parentheses should be capitalized (treated as a new sentence start).

## Using Tools (in practice) Again

This should fail: "in" should be capitalized (first word inside parentheses) and "practice" should be capitalized (major word).

## is This Going to Catch

First word "is" should be capitalized.

## One-stop Shop

Second segment "stop" in hyphenated word should be capitalized (AP: major word).

## Overview: the Basics

First word after colon "the" should be capitalized (AP: subphrase start).
