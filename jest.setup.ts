import '@testing-library/jest-dom'

jest.mock('@capacitor/browser', () => ({
  Browser: {
    open: jest.fn(),
    close: jest.fn(),
    addListener: jest.fn(),
    removeAllListeners: jest.fn(),
  },
}))

jest.mock('@capacitor/app', () => ({
  App: {
    addListener: jest.fn(() => Promise.resolve({ remove: jest.fn() })),
    removeAllListeners: jest.fn(),
  },
}))
