import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChallengePicker } from '../ChallengePicker'

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  single: jest.fn(),
  channel: jest.fn().mockReturnValue({
    send: jest.fn().mockResolvedValue({}),
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnThis(),
  }),
  removeChannel: jest.fn(),
}

jest.mock('../../lib/supabase', () => ({
  supabase: mockSupabase,
}))

jest.mock('../../lib/messages', () => ({
  sendMessage: jest.fn().mockResolvedValue({ data: { id: 'msg' }, error: null }),
}))

jest.mock('../../lib/challenges', () => ({
  createChallenge: jest.fn().mockResolvedValue({
    data: { id: 'c1', code: 'ABC12345', game_mode: 'online', time_seconds: 600 },
    error: null,
  }),
  getChallengeUrl: jest.fn().mockReturnValue('https://example.com/challenge/ABC12345'),
}))

describe('ChallengePicker', () => {
  const onClose = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabase.single.mockResolvedValue({ data: null, error: null })
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
    })
  })

  it('renders time options', () => {
    render(
      <ChallengePicker currentUserId="user1" friendId="user2" friendName="TestFriend" onClose={onClose} />
    )
    expect(screen.getByText('Challenge TestFriend')).toBeTruthy()
    expect(screen.getByText('5 min')).toBeTruthy()
    expect(screen.getByText('10 min')).toBeTruthy()
    expect(screen.getByText('15 min')).toBeTruthy()
    expect(screen.getByText('30 min')).toBeTruthy()
  })

  it('shows selected state for clicked time', () => {
    render(
      <ChallengePicker currentUserId="user1" friendId="user2" friendName="TestFriend" onClose={onClose} />
    )
    fireEvent.click(screen.getByText('15 min'))
    const buttons = screen.getAllByRole('button')
    const selectedButton = buttons.find(b => b.textContent?.includes('15 min'))
    expect(selectedButton?.className).toContain('border-amber-400')
  })

  it('shows result screen after creating challenge', async () => {
    render(
      <ChallengePicker currentUserId="user1" friendId="user2" friendName="TestFriend" onClose={onClose} />
    )
    fireEvent.click(screen.getByText('Create Challenge'))

    await waitFor(() => {
      expect(screen.getByText('Challenge Created!')).toBeTruthy()
    })

    expect(screen.getByText('Copy link')).toBeTruthy()
    expect(screen.getByText('Done')).toBeTruthy()
  })

  it('closes via cancel button', () => {
    render(
      <ChallengePicker currentUserId="user1" friendId="user2" friendName="TestFriend" onClose={onClose} />
    )
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
