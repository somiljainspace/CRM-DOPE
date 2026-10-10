module.exports = {
  preset: 'ts-jest',
  transform: { '^.+\.tsx?$': ['ts-jest', { isolatedModules: true, tsconfig: { allowSyntheticDefaultImports: true, esModuleInterop: true } }] },
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
};
