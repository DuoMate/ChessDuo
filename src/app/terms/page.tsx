export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <header className="fixed top-0 w-full z-40 bg-gray-900/80 backdrop-blur-md border-b border-gray-700/50 h-14 flex items-center px-4">
        <span className="text-xl font-extrabold italic uppercase tracking-tighter text-yellow-400">ChessDuo</span>
      </header>

      <main className="flex-1 pt-20 pb-12 px-4 max-w-3xl mx-auto w-full">
        <h1 className="text-3xl font-extrabold text-yellow-400 mb-8">Terms of Service</h1>
        <div className="space-y-6 text-gray-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-base font-bold text-white mb-2">1. Acceptance of Terms</h2>
            <p>
              By accessing or using ChessDuo, you agree to be bound by these Terms of Service.
              If you do not agree, please do not use the service.
            </p>
          </section>
          <section>
            <h2 className="text-base font-bold text-white mb-2">2. Description of Service</h2>
            <p>
              ChessDuo is a 2v2 team chess platform where two teams of two players compete on a shared board.
              Players simultaneously submit moves, and a chess engine selects the most accurate one.
            </p>
          </section>
          <section>
            <h2 className="text-base font-bold text-white mb-2">3. User Conduct</h2>
            <p>
              You agree not to use automated means to play, not to harass other players, and not to
              exploit bugs or vulnerabilities. Fair play is essential to the ChessDuo experience.
            </p>
          </section>
          <section>
            <h2 className="text-base font-bold text-white mb-2">4. Account Responsibility</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials
              and for all activities that occur under your account.
            </p>
          </section>
          <section>
            <h2 className="text-base font-bold text-white mb-2">5. Limitation of Liability</h2>
            <p>
              ChessDuo is provided "as is" without warranties of any kind. We are not liable for
              any damages arising from your use of the service.
            </p>
          </section>
          <section>
            <h2 className="text-base font-bold text-white mb-2">6. Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. Continued use after changes
              constitutes acceptance of the new terms.
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
