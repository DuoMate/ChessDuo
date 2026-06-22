const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || ''

export function getAppBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return SITE_URL || window.location.origin
  }
  return SITE_URL || ''
}
