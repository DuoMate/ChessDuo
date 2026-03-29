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
    setOrientation(orientation: 'white' | 'black'): void
    addMarker(type: MarkerType, square: string): void
    removeMarkers(type?: MarkerType): void
    getMarkers(type?: MarkerType): Marker[]
  }

  export interface MarkerType {
    class: string
    slice: string
    position?: string
  }

  export interface Marker {
    square: string
    type: MarkerType
  }
}

declare module 'cm-chessboard/src/extensions/markers/Markers' {
  import { Chessboard, MarkerType } from 'cm-chessboard'
  
  export const MARKER_TYPE: {
    frame: MarkerType
    framePrimary: MarkerType
    frameDanger: MarkerType
    circle: MarkerType
    circlePrimary: MarkerType
    circleDanger: MarkerType
    circleDangerFilled: MarkerType
    square: MarkerType
    dot: MarkerType
    bevel: MarkerType
  }

  export class Markers {
    constructor(chessboard: Chessboard, props?: object)
  }
}
