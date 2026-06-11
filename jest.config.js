const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@capacitor/browser$': '<rootDir>/src/lib/__mocks__/capacitor-browser.ts',
    '^@capacitor/app$': '<rootDir>/src/lib/__mocks__/capacitor-app.ts',
    '^cm-chessboard$': '<rootDir>/src/__mocks__/cm-chessboard.ts',
    '^cm-chessboard/src/extensions/markers/Markers$': '<rootDir>/src/__mocks__/cm-chessboard-markers.ts',
  },
}

module.exports = createJestConfig(customJestConfig)
