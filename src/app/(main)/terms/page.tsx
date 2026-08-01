'use client'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { BackButton } from '@/components/BackButton'

export default function TermsPage() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 dark:bg-[var(--color-page-bg)] text-gray-900 dark:text-white">
      <div className="max-w-2xl mx-auto px-4 py-12 pb-20">
        <div className="mb-6">
          <BackButton label="Back to ChessDuo" />
        </div>

        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-yellow-600/60 dark:text-yellow-400/60 text-sm mb-8">ChessDuo is a product of Navron</p>

        <section className="space-y-6 text-gray-600 dark:text-gray-300 leading-relaxed">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">1. Acceptance of Terms</h2>
            <p>
              By accessing or using ChessDuo (the &quot;Service&quot;), you agree to be bound by these Terms of Service and our{' '}
              <a href="/privacy" className="text-yellow-600 dark:text-yellow-400 hover:underline">Privacy Policy</a>.
              If you do not agree to these terms, please do not use the Service.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">2. The Service</h2>
            <p>
              ChessDuo is a multiplayer chess game that lets you play 2v2, 1v1 duels, four-player matches, and offline practice.
              Game modes include Quick Play, Duo, Duel, Four-Player, and offline play against bots.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">3. Accounts</h2>
            <p>
              You may play as a guest or create an account via Supabase Auth. When you create an account, you are responsible for
              keeping your credentials secure and for all activity that occurs under your account.
            </p>
            <p className="mt-2">
              The Service is intended for users aged 13 and older. If you are under 13, please use guest mode, which does not
              require an account. By creating an account you confirm you are at least 13 years of age.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">4. Premium Subscription</h2>
            <p>
              ChessDuo offers a premium subscription that unlocks premium insights and other features. Premium purchases are
              processed by <strong>Creem</strong>, a Merchant of Record, who is the seller of record for the transaction. Your
              receipt and bank statement will show a charge from Creem.
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Subscriptions auto-renew on a monthly or yearly basis depending on the plan you select.</li>
              <li>You can cancel your subscription at any time. Cancellation takes effect at the end of the current billing period.</li>
              <li>Purchases are non-refundable, except where required by applicable law.</li>
              <li>By purchasing, you also agree to Creem&apos;s terms of service, available at{' '}
                <a href="https://creem.io/terms" className="text-yellow-600 dark:text-yellow-400 hover:underline" target="_blank" rel="noopener noreferrer">creem.io/terms</a>.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">5. User Conduct</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Use the Service for any unlawful purpose or in violation of these terms</li>
              <li>Cheat, exploit bugs, or use automated tools that interfere with fair play</li>
              <li>Harass, abuse, or threaten other players through chat or any other feature</li>
              <li>Attempt to access another user&apos;s account or data</li>
              <li>Interfere with the Service&apos;s servers, networks, or infrastructure</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">6. Intellectual Property</h2>
            <p>
              The Service, including its software, design, graphics, and content, is owned by Navron and protected by applicable
              intellectual property laws. You may not copy, modify, distribute, or reverse engineer any part of the Service.
              Stockfish, used for move evaluation, is licensed under the GNU GPL v3 and remains the property of its authors.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">7. Disclaimer of Warranties</h2>
            <p>
              The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, whether express
              or implied. We do not warrant that the Service will be uninterrupted, error-free, or secure.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">8. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Navron shall not be liable for any indirect, incidental, special,
              consequential, or punitive damages, or any loss of profits or data, arising out of or in connection with your use
              of the Service.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">9. Termination</h2>
            <p>
              We may suspend or terminate your access to the Service at any time if you violate these terms or if we determine
              that your use of the Service poses a risk to other users or to the Service itself.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">10. Changes to These Terms</h2>
            <p>
              We may update these Terms of Service from time to time. When we make material changes, we will update the
              &quot;Last updated&quot; date at the top of this page. Your continued use of the Service after changes are posted
              constitutes acceptance of the updated terms.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">11. Contact</h2>
            <p>
              If you have questions about these terms, contact us at:
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
