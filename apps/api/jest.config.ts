import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  setupFiles: ['<rootDir>/test/setup-env.ts', '<rootDir>/test/support/loopback-listen.ts'],
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
      },
    ],
  },
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
};

export default config;
