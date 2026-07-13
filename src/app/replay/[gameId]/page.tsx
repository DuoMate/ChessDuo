import ReplayPageClient from './client'

export function generateStaticParams() {
  return [{ gameId: 'placeholder' }]
}

export default function ReplayPage() {
  return <ReplayPageClient />
}
