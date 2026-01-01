## 2024-05-23 - Reusable Loading Patterns
**Learning:** Users perceive "text-only" loading states as lower quality compared to skeleton screens, even for small components. The `LoadingTable` component significantly improves perceived performance in data-heavy tables.
**Action:** Always prefer `LoadingTable` or `LoadingSpinner` over plain text "Loading..." messages in data components.
