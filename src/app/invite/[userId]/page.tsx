import InvitePageClient from './client'

export function generateStaticParams() {
  return [{ userId: 'placeholder' }]
}

export default function InvitePage() {
  return <InvitePageClient />
}
