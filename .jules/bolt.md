## 2024-05-19 - O(n^2) Bottleneck in React Reduce Operations
**Learning:** Found a common performance pitfall where `.reduce()` combined with object spread operator (`{ ...acc }`) causes $O(n^2)$ time complexity during React renders. In `src/app/page.tsx`, this pattern was used for processing `currentFetchedAnswers` on every render.
**Action:** Always mutate the accumulator directly (`acc[key] = value`) inside `.reduce()` when building dictionaries/objects from arrays to ensure $O(n)$ linear time complexity, especially inside functional React components where this code runs frequently.
