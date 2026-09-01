'use client'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { BackButton } from '@/components/BackButton'

export default function PrivacyPage() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 dark:bg-[var(--color-page-bg)] text-gray-900 dark:text-white">
      <div className="max-w-2xl mx-auto px-4 py-12 pb-20">
        <div className="mb-6">
          <BackButton label="Back to ChessDuo" />
        </div>

        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-yellow-600/60 dark:text-yellow-400/60 text-sm mb-2">ChessDuo is a product of Navron</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-8">Last updated: September 1, 2026</p>
        <p className="text-sm mb-8">
          Read our{' '}
          <a href="/terms" className="text-yellow-600 dark:text-yellow-400 hover:underline">Terms of Service</a>.
        </p>

        <section className="space-y-6 text-gray-600 dark:text-gray-300 leading-relaxed">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">1. Information We Collect</h2>
            <p>
              When you use ChessDuo, we collect the following information to provide our multiplayer chess service:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Email address</strong> — when you sign up for an account via Supabase Auth</li>
              <li><strong>Username</strong> — your chosen display name (shown to teammates and opponents)</li>
              <li><strong>Game data</strong> — your completed games including moves played, accuracy scores, and match results</li>
              <li><strong>Anonymous session data</strong> — if you play as a guest without signing up, we store a temporary identifier to track your game</li>
              <li><strong>Technical &amp; diagnostic data</strong> — device model, operating system version, and app version, plus crash/error reports (including an error message and stack trace and, when applicable, a match or room identifier) that help us diagnose and fix issues</li>
              <li><strong>Push notification tokens</strong> — a device identifier provided by Firebase Cloud Messaging so we can send you game invites, friend requests, and chat notifications. You can disable notifications at any time in your device or app settings</li>
              <li><strong>Billing status</strong> — if you subscribe to premium features through Google Play, we store the subscription plan and its active status to provide the premium experience</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">2. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>To authenticate you and maintain your account</li>
              <li>To display your match history and stats</li>
              <li>To enable real-time multiplayer features (via Supabase)</li>
              <li>To provide friend lists, chat, and challenge features</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">3. Data Storage & Security</h2>
            <p>
              All game data is stored on Supabase, a secure cloud database with row-level security (RLS) ensuring you can only access your own data. Authentication tokens are managed by Supabase Auth and stored securely in your browser/app.
            </p>
            <p className="mt-2">
              ChessDuo communicates exclusively over HTTPS. To operate the service, data is shared
              only with the service providers described in Section 5 (Supabase, Cloudflare, Render,
              Google Play, and Firebase) strictly for the purposes listed there. We do not sell your
              personal information.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">4. Chess Engine</h2>
            <p>
              ChessDuo uses Stockfish (an open-source chess engine) running on our backend server to evaluate moves. The server receives board positions (FEN strings) and candidate moves to perform evaluation. Board positions are processed in-memory and are not stored on the engine server.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">5. Third-Party Services</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Supabase</strong> — for authentication, real-time messaging, and database storage. See <a href="https://supabase.com/privacy" className="text-yellow-600 dark:text-yellow-400 hover:underline" target="_blank" rel="noopener noreferrer">Supabase Privacy Policy</a>.</li>
              <li><strong>Cloudflare</strong> — for hosting the web application on the edge. See <a href="https://www.cloudflare.com/privacypolicy/" className="text-yellow-600 dark:text-yellow-400 hover:underline" target="_blank" rel="noopener noreferrer">Cloudflare Privacy Policy</a>.</li>
              <li><strong>Render</strong> — for hosting the Stockfish evaluation backend. See <a href="https://render.com/privacy" className="text-yellow-600 dark:text-yellow-400 hover:underline" target="_blank" rel="noopener noreferrer">Render Privacy Policy</a>.</li>
              <li><strong>Google Play</strong> — for premium subscription payments and notifications on the Android app. When you make a purchase, payment processing is handled by Google Play. See <a href="https://payments.google.com/payments/apis-secure/get_legal_document?ldo=0&ldt=privacynotice" className="text-yellow-600 dark:text-yellow-400 hover:underline" target="_blank" rel="noopener noreferrer">Google Payments Privacy Notice</a>.</li>
              <li><strong>Firebase Cloud Messaging</strong> — for delivering push notifications on Android. See <a href="https://firebase.google.com/support/privacy" className="text-yellow-600 dark:text-yellow-400 hover:underline" target="_blank" rel="noopener noreferrer">Firebase Privacy Policy</a>.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">6. Your Rights</h2>
            <p>
              You can access, review, and delete your data at any time. To delete your account and all
              associated data within the app, go to <strong>Settings &rarr; Manage Account &rarr; Delete
              Account</strong>. Your match history can be viewed on the History page and removed when your
              account is deleted. If you prefer, you may also request deletion by contacting us at the email
              address below; we will process eligible requests promptly.
            </p>
            <p className="mt-2">
              If you purchased a premium subscription through Google Play, you can manage or cancel it at any
              time in your Google Play account settings. Cancellation takes effect at the end of the current
              billing period.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">7. Children&apos;s Privacy</h2>
            <p>
              ChessDuo is a family-friendly chess game accessible to all ages. Our chat and account features are designed for users 13 and older. If you are under 13, we encourage you to play using guest mode, which does not require account creation or collect personal data.
            </p>
            <p className="mt-2">
              We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal data, please contact us and we will promptly delete it.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">8. Contact</h2>
            <p>
              If you have questions about this privacy policy or your data, contact us at:
            </p>
            <p className="mt-2 text-yellow-600 dark:text-yellow-400">
              chessdoubles27@gmail.com
            </p>
          </div>
        </section>
      </div>
    </div>
    </ErrorBoundary>
  )
}
