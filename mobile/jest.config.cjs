module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  testMatch: ['**/__tests__/**/*.test.{js,jsx,ts,tsx}'],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/setupTests.ts',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react-native$': '<rootDir>/__mocks__/react-native.js',
    '^@expo/vector-icons$': '<rootDir>/__mocks__/expo-vector-icons.js',
    '^@tensorflow/tfjs$': '<rootDir>/__mocks__/tensorflow.js',
    '^@tensorflow/tfjs-react-native$': '<rootDir>/__mocks__/tensorflow-react-native.js',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
      },
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@expo|expo|@react-navigation|@tensorflow)/)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};