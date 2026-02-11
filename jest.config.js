/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    // Map .js to .ts for any import from src/ in the project (relative or absolute)
    '^src/(.+)\\.js$': '<rootDir>/src/$1.ts',
    '^\.\./src/(.+)\\.js$': '<rootDir>/src/$1.ts',
    '^\.\./services/(.+)\\.js$': '<rootDir>/src/services/$1.ts',
  },
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  transform: {}, // required for ESM mode
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  testMatch: ['<rootDir>/src/test/**/*.jest.test.ts'],
  // resolver: undefined, // use default resolver
};