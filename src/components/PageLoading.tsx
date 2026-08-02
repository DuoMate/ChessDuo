'use client'

import { Spinner } from '@/components/Spinner'
import { usePathname } from 'next/navigation'

interface PageLoadingProps {
  label?: string
  size?: 'md' | 'lg'
  className?: string
}

const NO_BOTTOM_PAD_PATHNAMES = ['/game', '/duel', '/']

export function PageLoading({ label = 'Loading...', size = 'md', className = '' }: PageLoadingProps) {
  const pathname = usePathname()
  const needsPad = !NO_BOTTOM_PAD_PATHNAMES.includes(pathname)
  const padding = needsPad ? 'pb-20' : ''

  return (
    <div
      className={`min-h-screen bg-gray-50 dark:bg-[var(--color-page-bg)] text-gray-900 dark:text-white flex items-center justify-center ${padding} ${className}`}
    >
      <Spinner size={size} label={label} />
    </div>
  )
}
