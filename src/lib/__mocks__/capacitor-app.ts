export const App = {
  addListener: jest.fn(() => Promise.resolve({ remove: jest.fn() })),
  removeAllListeners: jest.fn(),
}
