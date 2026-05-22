import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChatPanel } from '../ChatPanel'

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  or: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
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
  sendMessage: jest.fn().mockResolvedValue({
    data: { id: 'msg1', sender_id: 'user1', receiver_id: 'user2', content: 'Hi', read: false, created_at: new Date().toISOString() },
    error: null,
  }),
  getConversation: jest.fn().mockResolvedValue([]),
  markMessagesAsRead: jest.fn().mockResolvedValue(undefined),
  subscribeToMessages: jest.fn().mockReturnValue(() => {}),
}))

describe('ChatPanel', () => {
  const onClose = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabase.single.mockResolvedValue({ data: null, error: null })
    jest.spyOn(mockSupabase, 'or').mockReturnValue({
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
    } as any)
  })

  it('renders chat panel with friend name', async () => {
    render(
      <ChatPanel currentUserId="user1" friendId="user2" friendName="TestFriend" onClose={onClose} />
    )

    await waitFor(() => {
      expect(screen.getByText('TestFriend')).toBeTruthy()
    })
  })

  it('shows empty state when no messages', async () => {
    render(
      <ChatPanel currentUserId="user1" friendId="user2" friendName="TestFriend" onClose={onClose} />
    )

    await waitFor(() => {
      expect(screen.getByText('No messages yet. Say hello!')).toBeTruthy()
    })
  })

  it('has a functional close button', () => {
    render(
      <ChatPanel currentUserId="user1" friendId="user2" friendName="TestFriend" onClose={onClose} />
    )

    const closeButton = screen.getByText('✕')
    fireEvent.click(closeButton)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('has message input and send button', () => {
    render(
      <ChatPanel currentUserId="user1" friendId="user2" friendName="TestFriend" onClose={onClose} />
    )

    expect(screen.getByPlaceholderText('Type a message...')).toBeTruthy()
    expect(screen.getByText('Send')).toBeTruthy()
  })

  it('disables send button when input is empty', () => {
    render(
      <ChatPanel currentUserId="user1" friendId="user2" friendName="TestFriend" onClose={onClose} />
    )

    const sendButton = screen.getByText('Send')
    expect(sendButton).toBeDisabled()
  })
})
