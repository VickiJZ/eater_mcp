module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'mjs', 'cjs', 'jsx', 'json', 'node'],
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js|mjs)',
    '**/?(*.)+(spec|test).+(ts|tsx|js|mjs)',
  ],
  transform: {
    '^.+\.m?[tj]sx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
        useESM: true,
      },
    ],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(node-fetch|data-uri-to-buffer|fetch-blob|formdata-polyfill|firebase-admin)/)',
  ],
  moduleNameMapper: {
    '^(\.\.?/.*)\.js$': '$1',
  },
  testPathIgnorePatterns: [
    '/node_modules/',
  ],
};
