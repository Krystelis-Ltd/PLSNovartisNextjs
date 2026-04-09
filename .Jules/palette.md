## 2024-04-07 - Screen Reader Accessibility for Icon-only Buttons
**Learning:** Found several icon-only buttons (Chatbot toggle, send message, Toast dismiss) missing `aria-label` attributes and screen-reader-hidden icons. These are critical for keyboard and screen reader accessibility as they otherwise read out visually irrelevant font-ligatures like "close" or "send".
**Action:** Always add `aria-label` to buttons without visible text and `aria-hidden="true"` to icon spans.
