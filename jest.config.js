module.exports = {
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },
  moduleFileExtensions: ['ts', 'js'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  testMatch: ['**/tests/**/*.test.(ts|js)'],
  testEnvironment: 'node',
  reporters: ['default', 'jest-junit'],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/config.ts',
    '!src/index.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 92,
      functions: 95,
      lines: 90,
      statements: 90,
    },
  },
};
