import { render, screen } from '@testing-library/react'
import { PageLoading } from '../PageLoading'

const mockUsePathname = jest.fn(() => '/history')
jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}))

describe('PageLoading', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/history')
  })

  it('renders default label "Loading..."', () => {
    render(<PageLoading />)
    expect(screen.getByText('Loading...')).toBeDefined()
  })

  it('renders custom label', () => {
    render(<PageLoading label="Loading game..." />)
    expect(screen.getByText('Loading game...')).toBeDefined()
  })

  it('renders with size lg', () => {
    render(<PageLoading label="Deleting..." size="lg" />)
    expect(screen.getByText('Deleting...')).toBeDefined()
  })

  it('renders role="status" for accessibility', () => {
    render(<PageLoading />)
    expect(screen.getByRole('status')).toBeDefined()
  })

  it('applies custom className', () => {
    render(<PageLoading className="my-custom-class" />)
    const container = document.querySelector('.my-custom-class')
    expect(container).toBeDefined()
  })

  it('does NOT add pb-20 on /game path', () => {
    mockUsePathname.mockReturnValue('/game')
    render(<PageLoading />)
    const container = screen.getByRole('status').parentElement
    expect(container?.className).not.toContain('pb-20')
  })

  it('adds pb-20 on /history path (has bottom nav)', () => {
    mockUsePathname.mockReturnValue('/history')
    render(<PageLoading />)
    const container = screen.getByRole('status').parentElement
    expect(container?.className).toContain('pb-20')
  })

  it('does NOT add pb-20 on /duel path', () => {
    mockUsePathname.mockReturnValue('/duel')
    render(<PageLoading />)
    const container = screen.getByRole('status').parentElement
    expect(container?.className).not.toContain('pb-20')
  })

  it('does NOT add pb-20 on / (home) path', () => {
    mockUsePathname.mockReturnValue('/')
    render(<PageLoading />)
    const container = screen.getByRole('status').parentElement
    expect(container?.className).not.toContain('pb-20')
  })
})
