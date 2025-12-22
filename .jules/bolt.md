## 2024-05-23 - Performance Optimization: TooltipProvider in Tables

**Learning:** `TooltipProvider` from Radix UI is a context provider. Rendering it inside every cell of a large table (e.g., in `DeviceSoftwareTable` or `DeviceCredentialsTable`) creates hundreds of context providers, significantly increasing component depth and memory usage, leading to sluggish rendering and scroll performance.

**Action:**
1. Moved `TooltipProvider` to wrap the entire `Table` (or parent container) instead of individual cells.
2. Memoized cell components (`HoverableCell`, `UrlCell`, `CopyableCell`) using `React.memo` to prevent unnecessary re-renders when the table updates.
3. This reduces the number of context providers from O(n) (where n is rows × cols) to O(1).
