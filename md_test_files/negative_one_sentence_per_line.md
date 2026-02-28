# Negative Fixture: One Sentence per Line

<!-- Lint: `npx markdownlint-cli2 md_test_files/negative_one_sentence_per_line.md` -->
<!-- Expect: `one-sentence-per-line`. -->

## Section

This paragraph has two sentences. The second one is here.

- This bullet has two. They should be split.

1. This numbered item has two. Same here.

This should not catch; e.g.: here is some text.

- Bullet 1.
  - Sub-bullet that has multiple sentences. This is a second sentence on the same line.
    - Nested 3 deep now. Another sentence.

- **No command or path allowlists inside the container.** The sandbox agent runs in an already-sandboxed environment (the container).

This is the first sentence. **Bolded text** rest of the sentence.
