## 2026-05-12 - Missing aria-hidden on Material Symbols
**Learning:** Found multiple instances where the `material-symbols-outlined` class is used without `aria-hidden="true"`, which is an accessibility issue because screen readers might read the ligature text. Found this pattern missing from this application's components.
**Action:** Always add `aria-hidden="true"` to `<span className="material-symbols-outlined">...\</span>` elements to hide them from screen readers, preventing them from reading ligature texts.
