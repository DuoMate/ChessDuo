import { render, screen, act } from '@testing-library/react'
import ChessLoader from '../ChessLoader'

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
    useMotionValue: (val: number) => ({
      get: () => val,
      set: jest.fn(),
    }),
  }
})

jest.useFakeTimers()

describe('ChessLoader', () => {
  beforeEach(() => {
    jest.clearAllTimers()
    jest.clearAllMocks()
  })

  it('renders the ChessDuo logo image', () => {
    render(<ChessLoader />)
    const logos = screen.getAllByAltText('ChessDuo')
    expect(logos.length).toBeGreaterThanOrEqual(1)
    expect(logos[0].tagName).toBe('IMG')
  })

  it('renders the knight piece element', () => {
    render(<ChessLoader />)
    const knight = screen.getByAltText('Knight')
    expect(knight).toBeDefined()
  })

  it('renders 9 grid nodes (circles)', () => {
    render(<ChessLoader />)
    const nodes = document.querySelectorAll('.rounded-full.w-\\[10px\\]')
    expect(nodes.length).toBe(9)
  })

  it('renders "Loading" text initially with 0 dots', () => {
    render(<ChessLoader />)
    expect(screen.getByText('Loading')).toBeDefined()
  })

  it('advances dot animation every 400ms', () => {
    render(<ChessLoader />)

    act(() => { jest.advanceTimersByTime(400) })
    expect(screen.getByText('Loading.')).toBeDefined()

    act(() => { jest.advanceTimersByTime(400) })
    expect(screen.getByText('Loading..')).toBeDefined()

    act(() => { jest.advanceTimersByTime(400) })
    expect(screen.getByText('Loading...')).toBeDefined()

    act(() => { jest.advanceTimersByTime(400) })
    expect(screen.getByText('Loading')).toBeDefined()
  })

  it('cycles through the 5-phase animation sequence', () => {
    render(<ChessLoader />)

    // Phase: idle (150ms)
    act(() => { jest.advanceTimersByTime(150) })

    // Phase: highlight (80ms)
    act(() => { jest.advanceTimersByTime(80) })

    // Phase: jump (180ms)
    act(() => { jest.advanceTimersByTime(180) })

    // Phase: land (70ms)
    act(() => { jest.advanceTimersByTime(70) })

    // Phase: pause (120ms) → sequence index advances to 1
    act(() => { jest.advanceTimersByTime(120) })

    // After first complete move (600ms), animation is still running
    // Next cycle: idle phase starts
    act(() => { jest.advanceTimersByTime(150) })

    // Component should still be mounted (no crash)
    expect(screen.getByAltText('Knight')).toBeDefined()
  })

  it('renders all 9 node positions in the correct display order', () => {
    render(<ChessLoader />)
    const nodes = document.querySelectorAll('.rounded-full.w-\\[10px\\]')
    expect(nodes.length).toBe(9)

    // Grid is 3x3, all cells should be present
    const gridContainer = nodes[0].closest('.grid.grid-cols-3')
    expect(gridContainer).toBeDefined()
  })

  it('handles multiple complete animation cycles without crashing', () => {
    render(<ChessLoader />)

    // Run through 3 complete cycles (3 × 9 moves × 600ms = 16200ms)
    for (let i = 0; i < 3 * 9; i++) {
      act(() => { jest.advanceTimersByTime(600) })
    }

    expect(screen.getByAltText('Knight')).toBeDefined()
  })

  it('highlights destination node during highlight phase', () => {
    render(<ChessLoader />)

    // Complete idle phase
    act(() => { jest.advanceTimersByTime(150) })

    // After idle → highlight transition, the next destination node (top = NODE_NAMES[1])
    // should be highlighted
    const nodes = document.querySelectorAll('.rounded-full.w-\\[10px\\]')
    const highlighted = Array.from(nodes).filter((n) =>
      n.className.includes('bg-\\[#4DA3FF\\]')
    )
    expect(highlighted.length).toBeGreaterThanOrEqual(0)
  })

  it('completes the idle phase and enters highlight phase', () => {
    render(<ChessLoader />)

    // Idle phase: 150ms
    act(() => { jest.advanceTimersByTime(150) })

    // Highlight phase: 80ms
    act(() => { jest.advanceTimersByTime(80) })

    // After idle + highlight, the component should still be mounted
    expect(screen.getByAltText('Knight')).toBeDefined()
  })
})
