## 2026-05-09 - Accessibility of Icon-Only Buttons
**Learning:** Icon-only buttons using font ligatures (like Material Symbols) need both screen reader support and keyboard focus indicators.
**Action:** Always add `aria-label` to the button, `aria-hidden="true"` to the icon ligature span, and explicit focus classes (e.g. `focus-visible:outline-none focus-visible:ring-2`) for keyboard accessibility.
