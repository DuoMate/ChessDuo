import ChallengePageClient from './client'

export function generateStaticParams() {
  return [{ code: 'placeholder' }]
}

export default function ChallengePage() {
  return <ChallengePageClient />
}
