module.exports = {
  root: true,
  extends: ['eslint:recommended'],
  ignorePatterns: ['node_modules/', 'dist/', '.expo/', '.turbo/'],
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      parser: '@typescript-eslint/parser',
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
      ],
      rules: {
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        '@typescript-eslint/no-explicit-any': 'warn',
      },
    },
    {
      // React Native's Modal renders into a separate native window, so anything
      // in the React root tree — including the toast — is covered while one is
      // open. `@/components/feedback` exports a drop-in replacement that mounts
      // a ToastOutlet inside the modal's own window. This rule keeps the next
      // sheet from silently reintroducing the problem.
      files: ['apps/mobile/src/**/*.tsx'],
      excludedFiles: ['apps/mobile/src/components/feedback/Modal.tsx'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: 'react-native',
                importNames: ['Modal'],
                message:
                  "Import { Modal } from '@/components/feedback' instead — RN's Modal is a separate native window and hides the toast.",
              },
            ],
          },
        ],
      },
    },
  ],
};
