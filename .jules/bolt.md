## 2026-05-17 - Array .reduce O(n^2) Bottlenecks
**Learning:** In React components that re-render frequently (like `page.tsx` dealing with extraction pipelines), using the object spread operator (`{ ...acc }`) inside array `.reduce()` operations creates an O(n^2) performance bottleneck.
**Action:** Always mutate the accumulator directly (`acc[key] = value`) for O(n) time complexity, especially when working with collections inside React render functions.
