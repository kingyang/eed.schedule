// https://github.com/antfu/eslint-config
// https://github.com/antfu/eslint-flat-config-viewer
// npx eslint-flat-config-viewer
const antfu = require('@antfu/eslint-config').default
const perfectionistNatural = require('eslint-plugin-perfectionist/configs/recommended-natural')

const isDev = process.env.NODE_ENV === 'development'
const ruleStatus = isDev ? 'warn' : 'off'
module.exports = antfu(
  {
    ignores: [

    ],
  },
  perfectionistNatural,
  {
    rules: {
      'import/order': 'off',
      'jsdoc/check-param-name': 'off',
      'jsdoc/check-param-names': 'off',
      'jsdoc/require-returns-description': 'off',
      'no-cond-assign': 'off',
      'no-console': 'off',
      'no-extend-native': 'off',
      'node/prefer-global/buffer': 'off',
      'node/prefer-global/process': 'off',
      'perfectionist/sort-enums': 'off',
      'ts/ban-ts-comment': 'off',
      'unused-imports/no-unused-vars': ruleStatus,
    },
  },
)
