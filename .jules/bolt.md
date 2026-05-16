## 2024-05-16 - O(n^2) reduce bottlenecks
**Learning:** Using the object spread operator (`{ ...acc }`) inside an array `.reduce()` creates an O(n^2) bottleneck, particularly when calculating derived state in frequently re-rendered React components.
**Action:** Always mutate the accumulator directly (`acc[key] = value`) inside `.reduce()` to maintain O(n) time complexity.
