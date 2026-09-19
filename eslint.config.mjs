import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    '@stylistic/arrow-parens': ['error', 'always'],
    '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
    '@stylistic/comma-dangle': ['error', 'never'],
    '@stylistic/indent-binary-ops': 'off',
    '@stylistic/operator-linebreak': 'off',
    '@stylistic/quotes': ['error', 'single', { allowTemplateLiterals: 'always' }],
    '@typescript-eslint/no-explicit-any': 'error',
    'nuxt/nuxt-config-keys-order': 'off',
    'prefer-const': 'off',
    'vue/comma-dangle': ['error', 'never'],
    'vue/max-attributes-per-line': 'off',
    'vue/singleline-html-element-content-newline': 'off'
  }
})
