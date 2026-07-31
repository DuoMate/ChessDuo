import { NextRequest } from 'next/server'

function buildRedirectHtml(sessionId: string | null): string {
  const target = sessionId
    ? `chessduo://premium?session_id=${encodeURIComponent(sessionId)}`
    : 'chessduo://premium'

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
