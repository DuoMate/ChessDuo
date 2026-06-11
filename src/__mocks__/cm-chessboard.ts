// Mock for cm-chessboard
const mockAddMarker = jest.fn()
const mockRemoveMarkers = jest.fn()
const mockDisableMoveInput = jest.fn()
const mockEnableMoveInput = jest.fn()
const mockDestroy = jest.fn()
const mockSetPosition = jest.fn()
const mockSetOrientation = jest.fn()

let capturedHandler = null
let capturedColor = undefined

class Chessboard {
  addMarker(...args) { return mockAddMarker(...args) }
  removeMarkers(...args) { return mockRemoveMarkers(...args) }
  disableMoveInput(...args) { return mockDisableMoveInput(...args) }
  enableMoveInput(handler, color) {
    capturedHandler = handler
    capturedColor = color
    return mockEnableMoveInput(handler, color)
  }
  destroy(...args) { return mockDestroy(...args) }
  setPosition(...args) { return mockSetPosition(...args) }
  setOrientation(...args) { return mockSetOrientation(...args) }
}

export { Chessboard, mockAddMarker, mockRemoveMarkers, mockDisableMoveInput, mockEnableMoveInput, mockDestroy, mockSetPosition, mockSetOrientation }
export function getLastHandler() { return capturedHandler }
export function getLastColor() { return capturedColor }
export function resetCaptured() { capturedHandler = null; capturedColor = undefined }

export const COLOR = { white: 'white', black: 'black' }
export const INPUT_EVENT_TYPE = {
  moveInputStarted: 'moveInputStarted',
  moveInputCanceled: 'moveInputCanceled',
  validateMoveInput: 'validateMoveInput',
  moveInputFinished: 'moveInputFinished',
}
