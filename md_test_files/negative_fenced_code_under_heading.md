# Negative Fixture: Fenced Code Under Heading

<!-- Expect: fenced-code-under-heading (at most one go block per heading). -->

## Section With Two Go Blocks

First block.

```go
a
```

Second block under same heading (fails maxBlocksPerHeading: 1).

```go
b
```
