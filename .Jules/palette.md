## 2024-05-15 - [Add missing aria-labels to FABs and Icon buttons]
**Learning:** Floating icon buttons (`framer-motion` FABs) and inline icon buttons in this codebase lack accessible names and keyboard focus visibility by default.
**Action:** Always provide explicit `aria-label`s, add `aria-hidden="true"` to icon children, and implement explicit `focus-visible` ring variants when introducing new icon-only interactive elements.
