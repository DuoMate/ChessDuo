import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { SidebarNav } from '../SidebarNav'

const mockPush = jest.fn()
const mockPathname = jest.fn().mockReturnValue('/')

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: (...args: unknown[]) => mockPush(...args) }),
  usePathname: () => mockPathname(),
}))

describe('SidebarNav', () => {
  beforeEach(() => {
    mockPush.mockClear()
    mockPathname.mockReturnValue('/')
  })

  it('renders all 4 navigation tabs', () => {
    render(<SidebarNav unreadMessages={0} />)
    expect(screen.getByText('Home')).toBeDefined()
    expect(screen.getByText('History')).toBeDefined()
    expect(screen.getByText('Friends')).toBeDefined()
    expect(screen.getByText('Profile')).toBeDefined()
  })

  it('marks the active tab with aria-current=page', () => {
    mockPathname.mockReturnValue('/friends')
    render(<SidebarNav unreadMessages={0} />)
    const friends = screen.getByText('Friends').closest('button')
    expect(friends?.getAttribute('aria-current')).toBe('page')
  })

  it('navigates when a tab is clicked', () => {
    render(<SidebarNav unreadMessages={0} />)
    fireEvent.click(screen.getByText('History'))
    expect(mockPush).toHaveBeenCalledWith('/history')
  })

  it('does not navigate when clicking the active tab', () => {
    mockPathname.mockReturnValue('/history')
    render(<SidebarNav unreadMessages={0} />)
    fireEvent.click(screen.getByText('History'))
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('shows the unread badge on Friends when unreadMessages > 0', () => {
    render(<SidebarNav unreadMessages={5} />)
    const friends = screen.getByText('Friends').closest('button')
    expect(friends?.textContent).toContain('5')
  })

  it('caps the badge display at 99+', () => {
    render(<SidebarNav unreadMessages={150} />)
    const friends = screen.getByText('Friends').closest('button')
    expect(friends?.textContent).toContain('99+')
  })

  it('hides the badge when unreadMessages is 0', () => {
    render(<SidebarNav unreadMessages={0} />)
    const friends = screen.getByText('Friends').closest('button')
    expect(friends?.textContent).not.toContain('99')
  })
})
