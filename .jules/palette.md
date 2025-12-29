## 2024-05-23 - Reusable Copy Button Pattern
**Learning:**
Users often need to copy truncated or sensitive data (URLs, passwords, software versions). relying on "highlight to copy" or custom `navigator.clipboard.writeText` implementations leads to inconsistent experience (no feedback vs custom feedback) and accessibility gaps (missing ARIA labels).

**Action:**
Created a reusable `CopyButton` component (`components/ui/copy-button.tsx`) that:
1.  Handles the clipboard interaction safely.
2.  Provides consistent visual feedback (Check icon) for 2 seconds.
3.  Includes proper `aria-label` for screen readers (switching between "Copy [label]" and "Copied!").
4.  Can be easily composed into other components (e.g., inside Tooltips or Table cells).

Use this pattern whenever copy functionality is needed instead of ad-hoc implementations.
