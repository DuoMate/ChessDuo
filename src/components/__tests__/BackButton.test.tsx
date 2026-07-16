import { render, screen, fireEvent } from '@testing-library/react'
import { BackButton } from '../BackButton'

const mockBack = jest.fn()
const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
  }),
}))

describe('BackButton', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('calls router.back() when history length > 2', () => {
    Object.defineProperty(window, 'history', {
      value: { length: 5 },
      writable: true,
    })

    render(<BackButton label="Go Back" />)
    fireEvent.click(screen.getByRole('button'))

    expect(mockBack).toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('calls router.push("/") when history length <= 2', () => {
    Object.defineProperty(window, 'history', {
      value: { length: 2 },
      writable: true,
    })

    render(<BackButton label="Go Home" />)
    fireEvent.click(screen.getByRole('button'))

    expect(mockPush).toHaveBeenCalledWith('/')
    expect(mockBack).not.toHaveBeenCalled()
  })

  it('uses custom fallbackHref when provided', () => {
    Object.defineProperty(window, 'history', {
      value: { length: 1 },
      writable: true,
    })

    render(<BackButton label="Go Back" fallbackHref="/dashboard" />)
    fireEvent.click(screen.getByRole('button'))

    expect(mockPush).toHaveBeenCalledWith('/dashboard')
  })

  it('renders with default label "Back"', () => {
    render(<BackButton />)
    expect(screen.getByText('Back')).toBeInTheDocument()
  })

  it('renders with custom label', () => {
    render(<BackButton label="Go Home" />)
    expect(screen.getByText('Go Home')).toBeInTheDocument()
  })
})
