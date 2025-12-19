## 2024-05-23 - Performance Optimization: Memoization in SearchResults

**Learning:** Large lists in React components without memoization of derived data can lead to unnecessary re-computations on every render, even if the data hasn't changed. In `SearchResults.tsx`, the `groupedResults` derived state was being recalculated on every render, including when parent state changed (like selection), which is inefficient for large datasets.

**Action:** Applied `useMemo` to the expensive grouping operation and `React.memo` to child components to prevent unnecessary work. Also moved static regex patterns out of utility functions to avoid recompilation.
