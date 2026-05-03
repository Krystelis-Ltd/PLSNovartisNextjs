## 2024-05-03 - Missing ARIA labels on icon-only close buttons
**Learning:** The application has a pattern of using icon-only buttons (like `close` icons using `material-symbols-outlined`) across multiple modals and components without `aria-label`s. This is a recurring accessibility issue.
**Action:** Ensure all icon-only buttons have descriptive `aria-label` attributes for screen reader accessibility, and use `aria-hidden="true"` on the icon itself.
