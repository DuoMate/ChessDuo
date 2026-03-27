declare module 'cm-chessboard' {
  export const FEN: {
    start: string
    empty: string
  }

  export const COLOR: {
    white: 'white'
    black: 'black'
  }

  export const INPUT_EVENT_TYPE: {
    moveInputStarted: 'moveInputStarted'
    moveInputCanceled: 'moveInputCanceled'
    validateMoveInput: 'validateMoveInput'
    moveInputFinished: 'moveInputFinished'
  }

  export interface InputEvent {
    type: string
    squareFrom?: string
    squareTo?: string
  }

  export interface ChessboardProps {
    position?: string
    orientation?: 'white' | 'black'
    assetsUrl?: string
    enableMoveInput?: boolean
    extensions?: Extension[]
  }

  export type Extension = any

  export class Chessboard {
    constructor(container: HTMLElement, props?: ChessboardProps)
    setPosition(fen: string, animated?: boolean): Promise<void>
    getPosition(): string
    enableMoveInput(handler: (event: InputEvent) => boolean, color?: 'white' | 'black'): void
    disableMoveInput(): void
    destroy(): void
  }
}
