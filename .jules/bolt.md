## 2024-05-01 - React Compiler and manual memoization conflicts

**Learning:** When using the React Compiler with manual memoizations (like `useMemo` for derived states like `currentFetchedAnswers` or inline handlers), if you wrap asynchronous callbacks containing impure functions (like `Date.now()`) with `useCallback`, you might disrupt the compiler's ability to preserve manual memoization further up or run into purity issues where the body is considered a render function.

**Action:** Extract impure computations outside the render/hook definitions or ensure that your `useCallback` wraps the full asynchronous body properly. Be cautious mixing React 19 Compiler directives with heavy manual memoization in the same scope, especially around derived arrays/objects built from large state updates (like `extractionFeed`).
