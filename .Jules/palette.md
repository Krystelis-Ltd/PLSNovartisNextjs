## 2026-05-02 - Chatbot Icon Button Accessibility
**Learning:** Icon-only buttons using framer-motion lack focus indicators and accessible labels by default, hindering screen reader users and keyboard navigation. Using `aria-label` on the button, `aria-hidden="true"` on the inner material symbol span, and standard `focus-visible` tailwind classes resolves this.
**Action:** Always verify icon-only interactive elements have `aria-label` and apply `focus-visible` utility classes for keyboard accessibility.
