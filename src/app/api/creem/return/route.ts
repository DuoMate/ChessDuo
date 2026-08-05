import { NextRequest } from 'next/server'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://chessduo.navron.org'

function buildRedirectHtml(sessionId: string | null): string {
  // Redirect to the HTTPS /premium App Link (verified via assetlinks.json) instead
  // of the chessduo:// custom scheme. Custom schemes are non-clickable / unreliable
  // when opened from the system browser (see Bug 37). The App Link reopens the app
  // when verified; otherwise the browser loads the web /premium, which runs the same
  // verify-on-return flow. The /premium page auto-resolves the checkout id from
  // pending_checkout_id, so session_id is optional.
  const target = sessionId
    ? `${SITE_URL}/premium?session_id=${encodeURIComponent(sessionId)}`
    : `${SITE_URL}/premium`

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="refresh" content="0; url=${target}" />
    <title>Returning to ChessDuo...</title>
    <script>window.location.replace("${target}")</script>
  </head>
  <body>Returning to ChessDuo...</body>
</html>`
}

export function GET(request: NextRequest) {
  const url = new URL(request.url)
  const sessionId = url.searchParams.get('session_id')
  return new Response(buildRedirectHtml(sessionId), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
