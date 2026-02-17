module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/extensions'],
  testMatch: ['**/__tests__/**/*.spec.ts'],
  moduleNameMapper: {
    '^@theia/core/shared/inversify$': '<rootDir>/node_modules/@theia/core/shared/inversify',
    '^@theia/core/lib/(.*)$': '<rootDir>/node_modules/@theia/core/lib/$1',
    '^@theia/terminal/lib/(.*)$': '<rootDir>/node_modules/@theia/terminal/lib/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        target: 'ES2020',
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      }
    }]
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'extensions/**/src/**/*.ts',
    '!extensions/**/node_modules/**',
    '!extensions/**/__tests__/**',
  ],
};
