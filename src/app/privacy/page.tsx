import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy — ChessDuo',
  description: 'ChessDuo privacy policy — what data we collect and how we use it.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Link
          href="/"
          className="text-yellow-400 hover:text-yellow-300 text-sm mb-6 inline-block"
        >
          ← Back to ChessDuo
        </Link>

        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-gray-500 text-sm mb-8">Last updated: May 31, 2026</p>

        <section className="space-y-6 text-gray-300 leading-relaxed">
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">1. Information We Collect</h2>
            <p>
              When you use ChessDuo, we collect the following information to provide our multiplayer chess service:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Email address</strong> — when you sign up for an account via Supabase Auth</li>
              <li><strong>Username</strong> — your chosen display name (shown to teammates and opponents)</li>
              <li><strong>Game data</strong> — your completed games including moves played, accuracy scores, and match results</li>
              <li><strong>Anonymous session data</strong> — if you play as a guest without signing up, we store a temporary identifier to track your game</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">2. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>To authenticate you and maintain your account</li>
              <li>To display your match history and stats</li>
              <li>To enable real-time multiplayer features (via Supabase)</li>
              <li>To provide friend lists, chat, and challenge features</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">3. Data Storage & Security</h2>
            <p>
              All game data is stored on Supabase, a secure cloud database with row-level security (RLS) ensuring you can only access your own data. Authentication tokens are managed by Supabase Auth and stored securely in your browser/app.
            </p>
            <p className="mt-2">
              The app communicates exclusively over HTTPS. No game data or personal information is shared with third parties.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">4. Chess Engine</h2>
            <p>
              ChessDuo uses Stockfish (an open-source chess engine) running on our backend server to evaluate moves. The server receives board positions (FEN strings) and candidate moves to perform evaluation. Board positions are processed in-memory and are not stored on the engine server.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">5. Third-Party Services</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Supabase</strong> — for authentication, real-time messaging, and database storage. See <a href="https://supabase.com/privacy" className="text-yellow-400 hover:underline" target="_blank" rel="noopener noreferrer">Supabase Privacy Policy</a>.</li>
              <li><strong>Render</strong> — for hosting the web application and Stockfish backend. See <a href="https://render.com/privacy" className="text-yellow-400 hover:underline" target="_blank" rel="noopener noreferrer">Render Privacy Policy</a>.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">6. Your Rights</h2>
            <p>
              You can delete your account and all associated data at any time. To request data deletion, contact us at the email address below. Game history data can also be viewed on your History page within the app.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">7. Children&apos;s Privacy</h2>
            <p>
              ChessDuo is not directed at children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal data, please contact us.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">8. Contact</h2>
            <p>
              If you have questions about this privacy policy or your data, contact us at:
            </p>
            <p className="mt-2 text-yellow-400">
              support@chessduo.app
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
