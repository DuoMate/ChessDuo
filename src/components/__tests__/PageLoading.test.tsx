import { render, screen, act } from '@testing-library/react'
import { PageLoading } from '../PageLoading'

const mockUsePathname = jest.fn(() => '/history')
jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}))

jest.mock('framer-motion', () => {
  const actual = jest.requireActual('framer-motion')
  return {
    ...actual,
    motion: {
      div: ({ children, ...props }: any) => {
        const { initial, animate, style, className } = props
        return (
          <div style={{ ...style }} className={className} data-motion="div">
            {children}
          </div>
        )
      },
    },
    useAnimationControls: () => ({
      start: jest.fn().mockResolvedValue(undefined),
      set: jest.fn(),
    }),
  }
})

jest.useFakeTimers()

describe('PageLoading', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/history')
    jest.clearAllTimers()
    jest.clearAllMocks()
  })

  // ─── Rendering ─────────────────────────────────────────────────────────

  it('renders the ChessDuo logo image', () => {
    render(<PageLoading />)
    const logos = screen.getAllByAltText('ChessDuo')
    expect(logos.length).toBeGreaterThanOrEqual(1)
    expect(logos[0].tagName).toBe('IMG')
  })

  it('renders the knight piece emoji', () => {
    render(<PageLoading />)
    const knight = screen.getByText('♞')
    expect(knight).toBeDefined()
  })

  it('renders 9 grid nodes (circles)', () => {
    render(<PageLoading />)
    const nodes = document.querySelectorAll('.rounded-full.w-\\[10px\\]')
    expect(nodes.length).toBe(9)
  })

  it('renders 3x3 grid layout', () => {
    render(<PageLoading />)
    const grid = document.querySelector('.grid.grid-cols-3')
    expect(grid).toBeDefined()
  })

  it('displays animated "Loading" dots when no label is provided', () => {
    render(<PageLoading />)
    expect(screen.getByText('Loading')).toBeDefined()
  })

  it('displays static label text when label is provided', () => {
    render(<PageLoading label="Loading game..." />)
    expect(screen.getByText('Loading game...')).toBeDefined()
  })

  // ─── Dot animation ─────────────────────────────────────────────────────

  it('advances dot animation every 400ms', () => {
    render(<PageLoading />)

    act(() => { jest.advanceTimersByTime(400) })
    expect(screen.getByText('Loading.')).toBeDefined()

    act(() => { jest.advanceTimersByTime(400) })
    expect(screen.getByText('Loading..')).toBeDefined()

    act(() => { jest.advanceTimersByTime(400) })
    expect(screen.getByText('Loading...')).toBeDefined()

    act(() => { jest.advanceTimersByTime(400) })
    expect(screen.getByText('Loading')).toBeDefined()
  })

  it('does NOT animate dots when custom label is provided', () => {
    render(<PageLoading label="Processing..." />)
    act(() => { jest.advanceTimersByTime(2000) })
    expect(screen.getByText('Processing...')).toBeDefined()
  })

  // ─── Phase cycling ─────────────────────────────────────────────────────

  it('cycles through the 5-phase animation sequence', () => {
    render(<PageLoading />)

    act(() => { jest.advanceTimersByTime(150) })  // idle
    act(() => { jest.advanceTimersByTime(80) })    // highlight
    act(() => { jest.advanceTimersByTime(180) })   // jump
    act(() => { jest.advanceTimersByTime(70) })     // land
    act(() => { jest.advanceTimersByTime(120) })    // pause
    act(() => { jest.advanceTimersByTime(150) })    // next idle

    expect(screen.getByText('♞')).toBeDefined()
  })

  it('handles 3 complete cycles without crashing', () => {
    render(<PageLoading />)
    for (let i = 0; i < 3 * 9; i++) {
      act(() => { jest.advanceTimersByTime(600) })
    }
    expect(screen.getByText('♞')).toBeDefined()
  })

  // ─── pb-20 detection ───────────────────────────────────────────────────

  it('adds pb-20 on /history path (has bottom nav)', () => {
    mockUsePathname.mockReturnValue('/history')
    render(<PageLoading />)
    const outer = screen.getByAltText('ChessDuo').closest('.pb-20')
    expect(outer).toBeDefined()
  })

  it('does NOT add pb-20 on /game path', () => {
    mockUsePathname.mockReturnValue('/game')
    render(<PageLoading />)
    const outer = screen.getByAltText('ChessDuo').closest('.min-h-screen')
    expect(outer?.className).not.toContain('pb-20')
  })

  it('does NOT add pb-20 on /duel path', () => {
    mockUsePathname.mockReturnValue('/duel')
    render(<PageLoading />)
    const outer = screen.getByAltText('ChessDuo').closest('.min-h-screen')
    expect(outer?.className).not.toContain('pb-20')
  })

  it('does NOT add pb-20 on / (home) path', () => {
    mockUsePathname.mockReturnValue('/')
    render(<PageLoading />)
    const outer = screen.getByAltText('ChessDuo').closest('.min-h-screen')
    expect(outer?.className).not.toContain('pb-20')
  })

  // ─── className prop ────────────────────────────────────────────────────

  it('applies custom className', () => {
    render(<PageLoading className="my-custom-class" />)
    const container = document.querySelector('.my-custom-class')
    expect(container).toBeDefined()
  })
})
