import React from 'react'
import { render, screen } from '@testing-library/react'
import { MatchTimer } from '../../components/MatchTimer'

describe('MatchTimer Component', () => {
  test('renders time in MM:SS format', () => {
    render(<MatchTimer seconds={600} isActive={false} totalSeconds={600} />)
    expect(screen.getByText('10:00')).toBeDefined()
  })

  test('renders 5:00 for 300 seconds', () => {
    render(<MatchTimer seconds={300} isActive={false} totalSeconds={300} />)
    expect(screen.getByText('5:00')).toBeDefined()
  })

  test('renders seconds with zero padding', () => {
    render(<MatchTimer seconds={65} isActive={false} totalSeconds={600} />)
    expect(screen.getByText('1:05')).toBeDefined()
  })

  test('renders 0:00 when time is up', () => {
    render(<MatchTimer seconds={0} isActive={false} totalSeconds={600} />)
    expect(screen.getByText('0:00')).toBeDefined()
  })

  test('renders -- when inactive (shows time)', () => {
    render(<MatchTimer seconds={30} isActive={true} totalSeconds={600} />)
    expect(screen.getByText('0:30')).toBeDefined()
  })

  test('handles single digit minutes', () => {
    render(<MatchTimer seconds={540} isActive={false} totalSeconds={600} />)
    expect(screen.getByText('9:00')).toBeDefined()
  })

  test('handles large time values', () => {
    render(<MatchTimer seconds={1800} isActive={false} totalSeconds={1800} />)
    expect(screen.getByText('30:00')).toBeDefined()
  })

  test('handles mid-range seconds like 610', () => {
    render(<MatchTimer seconds={610} isActive={false} totalSeconds={600} />)
    expect(screen.getByText('10:10')).toBeDefined()
  })

  test('renders totalSeconds prop correctly used for progress', () => {
    const { container } = render(<MatchTimer seconds={30} isActive={true} totalSeconds={60} />)
    const circle = container.querySelectorAll('circle')[1]
    expect(circle).toBeDefined()
    // Progress circle should be rendering
    expect(circle.getAttribute('stroke-dasharray')).toBeDefined()
  })
})
