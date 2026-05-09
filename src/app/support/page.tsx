export default function SupportPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <header className="fixed top-0 w-full z-40 bg-gray-900/80 backdrop-blur-md border-b border-gray-700/50 h-14 flex items-center px-4">
        <span className="text-xl font-extrabold italic uppercase tracking-tighter text-yellow-400">ChessDuo</span>
      </header>

      <main className="flex-1 pt-20 pb-12 px-4 max-w-3xl mx-auto w-full">
        <h1 className="text-3xl font-extrabold text-yellow-400 mb-8">Support</h1>
        <div className="space-y-6 text-gray-300 text-sm leading-relaxed">
          <section className="glass-panel rounded-xl p-5">
            <h2 className="text-base font-bold text-white mb-2">How to Play</h2>
            <p className="mb-3">
              ChessDuo is a 2v2 team chess game. You and a teammate simultaneously submit moves — 
              neither sees the other&apos;s choice. A chess engine evaluates both and plays the more accurate one.
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>Select your opponent difficulty on the home screen</li>
              <li>Tap a piece, then tap its destination to submit your move</li>
              <li>Your teammate bot (or friend) does the same simultaneously</li>
              <li>The engine picks the winner — green highlight stays, red retracts</li>
              <li>A 10-second timer keeps the action fast-paced</li>
            </ul>
          </section>

          <section className="glass-panel rounded-xl p-5">
            <h2 className="text-base font-bold text-white mb-2">Game Modes</h2>
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-bold text-yellow-400">Training (Offline)</h3>
                <p className="text-gray-400">Play against bots with an AI teammate. Perfect for practice.</p>
              </div>
              <div>
                <h3 className="text-sm font-bold text-yellow-400">War Room (Online)</h3>
                <p className="text-gray-400">Create a room, share the code, and play 2v2 with friends.</p>
              </div>
            </div>
          </section>

          <section className="glass-panel rounded-xl p-5">
            <h2 className="text-base font-bold text-white mb-2">Contact Us</h2>
            <p className="mb-3">
              Having issues or want to share feedback? We&apos;d love to hear from you.
            </p>
            <a
              href="https://github.com/DuoMate/ChessDuo/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-400 hover:text-yellow-300 underline font-bold"
            >
              Report an Issue on GitHub →
            </a>
          </section>

          <section className="glass-panel rounded-xl p-5">
            <h2 className="text-base font-bold text-white mb-2">FAQs</h2>
            <div className="space-y-3">
              <div>
                <h3 className="text-xs font-bold text-yellow-400 uppercase">What do the accuracy percentages mean?</h3>
                <p className="text-gray-400">Accuracy compares your move to the engine&apos;s best move. 95%+ is great, 80-94% is good, below 80% needs work.</p>
              </div>
              <div>
                <h3 className="text-xs font-bold text-yellow-400 uppercase">Why did my teammate&apos;s move get played instead of mine?</h3>
                <p className="text-gray-400">The engine always selects the more accurate move. If your teammate chose a better move, it gets played.</p>
              </div>
              <div>
                <h3 className="text-xs font-bold text-yellow-400 uppercase">Can I change difficulty mid-game?</h3>
                <p className="text-gray-400">No. Difficulty is set before the game starts. Finish the current match to change it.</p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
