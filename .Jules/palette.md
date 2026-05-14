## 2026-05-14 - Icon-Only Button Accessibility
**Learning:** Icon-only buttons using Material Symbols across the codebase often lack `aria-label`, `aria-hidden="true"` on the icon, and keyboard focus styles (`focus-visible`).
**Action:** Always add `aria-label` to the button, `aria-hidden="true"` to the icon span, and `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current` (or equivalent) for keyboard navigation.
