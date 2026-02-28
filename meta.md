# Bundle Analysis Report

This report helps identify bundle size issues, dependency bloat, and optimization opportunities.

## Table of Contents

- [Quick Summary](#quick-summary)
- [Largest Modules by Output Contribution](#largest-modules-by-output-contribution)
- [Entry Point Analysis](#entry-point-analysis)
- [Dependency Chains](#dependency-chains)
- [Full Module Graph](#full-module-graph)
- [Raw Data for Searching](#raw-data-for-searching)

---

## Quick Summary

| Metric | Value |
|--------|-------|
| Total output size | 52.14 KB |
| Input modules | 1 |
| Entry points | 1 |
| ESM modules | 1 |

## Largest Modules by Output Contribution

Modules sorted by bytes contributed to the output bundle. Large modules may indicate bloat.

| Output Bytes | % of Total | Module | Format |
|--------------|------------|--------|--------|
| 52.14 KB | 100.0% | `src/public/assets/app.js` | esm |

## Entry Point Analysis

Each entry point and the total code it loads (including shared chunks).

### Entry: `src/public/assets/app.js`

**Output file**: `./app.js`
**Bundle size**: 52.14 KB

**Bundled modules** (sorted by contribution):

| Bytes | Module |
|-------|--------|
| 52.14 KB | `src/public/assets/app.js` |

## Dependency Chains

For each module, shows what files import it. Use this to understand why a module is included.


## Full Module Graph

Complete dependency information for each module.

### `src/public/assets/app.js`

- **Output contribution**: 52.14 KB
- **Format**: esm
- **Imported by**: (entry point or orphan)

## Raw Data for Searching

This section contains raw, grep-friendly data. Use these patterns:
- `[MODULE:` - Find all modules
- `[OUTPUT_BYTES:` - Find output contribution for each module
- `[IMPORT:` - Find all import relationships
- `[IMPORTED_BY:` - Find reverse dependencies
- `[ENTRY:` - Find entry points
- `[EXTERNAL:` - Find external imports
- `[NODE_MODULES:` - Find node_modules files

### All Modules

```
[MODULE: src/public/assets/app.js]
[OUTPUT_BYTES: src/public/assets/app.js = 52143 bytes]
[FORMAT: src/public/assets/app.js = esm]
```

### All Imports

```
```

### Reverse Dependencies (Imported By)

```
```

### Entry Points

```
[ENTRY: src/public/assets/app.js -> ./app.js (52144 bytes)]
```

