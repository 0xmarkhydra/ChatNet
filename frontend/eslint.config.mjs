import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

// Scope: Rules of React (hooks, purity, refs, immutability, effects).
// Existing violations are recorded in lint-baseline.json and may not grow
// (see scripts/lint-ratchet.mjs). Do not disable a rule to make the check pass;
// if an exception is truly needed, explain the concrete reason at the call site.
export default [
  { ignores: ['dist/**', 'node_modules/**', 'output/**', 'dev/**', 'public/**', 'scripts/**'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs['recommended-latest'].rules },
  },
]
