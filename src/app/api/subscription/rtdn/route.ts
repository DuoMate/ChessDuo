/**
 * RTDN (Real-Time Developer Notifications) webhook endpoint.
 *
 * Future: Google Play sends subscription lifecycle events (renewal, cancellation,
 * grace period, account hold, etc.) to a Cloud Pub/Sub topic. This endpoint
 * receives those events and updates the subscription state in Supabase.
 *
 * Implementation plan:
 *   1. Configure RTDN in Google Play Console → link to Cloud Pub/Sub topic
 *   2. Create a Push subscription delivering to this endpoint
 *   3. Verify the Pub/Sub message signature (JWT from Google)
 *   4. Parse subscriptionNotification → call Google Play API to verify
 *   5. Update profiles table via SubscriptionStateMachine transitions
 *
 * For now, subscription state is refreshed via /api/subscription/status
 * on app startup (expiry < 3 days, last_verified > 24h, pending, restore).
 */
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'RTDN not yet implemented. Subscription state is verified on app startup.' },
    { status: 501 },
  )
}
