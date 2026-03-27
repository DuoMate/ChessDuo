declare module 'stockfish' {
  interface Stockfish {
    postMessage: (msg: string) => void
    addMessageListener: (fn: (line: string) => void) => void
    removeMessageListener: (fn: (line: string) => void) => void
    terminate: () => void
  }

  function Stockfish(): Promise<Stockfish>
  export default Stockfish
}
