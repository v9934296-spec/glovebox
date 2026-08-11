const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/**', 'coverage/**'] },
  {
    files: ['supabase/functions/**/*.ts'],
    rules: {
      // Supabase Edge Functions run in Deno and legitimately use Deno's npm: specifier.
      'import/no-unresolved': 'off',
    },
  },
]);
