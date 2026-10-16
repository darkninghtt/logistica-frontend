import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    languageOptions: { globals: { ...globals.browser } },
    rules: { '@typescript-eslint/no-explicit-any': 'error' },
  },
  {
    // Solo el cliente axios puede importar axios (regla de la semana 1).
    files: ['src/**/*.{ts,vue}'],
    ignores: ['src/api/http.ts', 'src/api/http.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [{ name: 'axios', message: 'Usa el cliente de src/api/http.ts.' }] },
      ],
    },
  },
  prettier,
)
