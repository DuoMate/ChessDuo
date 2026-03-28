importScripts('/stockfish/stockfish-18-asm.js');

let stockfish = new Stockfish();

stockfish.onmessage = function(msg) {
  self.postMessage(msg);
};

self.postMessage('ready');

self.onmessage = function(e) {
  if (stockfish) {
    stockfish.postMessage(e.data);
  }
};
