## 2024-05-23 - Reusable Loading Components
**Learning:** The application has a dedicated `components/ui/loading.tsx` file with reusable components like `LoadingTable`, but developers often default to plain text loading indicators which creates visual inconsistency.
**Action:** When identifying loading states, always check `components/ui/loading.tsx` first and replace text-only indicators with the appropriate skeleton loader (e.g., `LoadingTable` for tabular data) to maintain UI polish and perceived performance.
