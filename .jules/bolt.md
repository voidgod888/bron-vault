## 2024-05-23 - Performance Optimization: Memoization in FileTreeViewer

**Learning:** The `FileTreeViewer` component was recalculating the entire file tree structure (O(n log n)) on every render, which was particularly expensive for devices with thousands of files. This caused UI lag when interacting with other elements in the panel.

**Action:** Moved the pure function `buildASCIITree` outside the component scope to avoid function recreation and wrapped its execution in `useMemo` to cache the result based on file inputs. This ensures the expensive tree building only happens when data actually changes.

## 2026-01-03 - Performance Optimization: TooltipProvider Hoisting

**Learning:** Rendering `TooltipProvider` inside individual table cells (`HoverableCell`, `UrlCell`) creates a significant performance bottleneck (N+1 providers) in large tables like `DeviceSoftwareTable` and `DeviceCredentialsTable`. This also breaks the intended "skip delay" behavior of grouped tooltips.

**Action:** Hoist the `TooltipProvider` to wrap the entire table or parent container. This reduces the number of context providers to 1 per table and ensures correct tooltip grouping behavior with `delayDuration={200}`.
