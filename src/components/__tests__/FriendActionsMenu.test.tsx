import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FriendActionsMenu } from '../FriendActionsMenu'

describe('FriendActionsMenu', () => {
  const onDelete = jest.fn()
  const onMessage = jest.fn()
  const onChallenge = jest.fn()
  const onBlock = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the three-dots button', () => {
    render(<FriendActionsMenu onDelete={onDelete} onMessage={onMessage} onChallenge={onChallenge} onBlock={onBlock} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(1)
  })

  it('opens menu and shows actions on click', async () => {
    render(<FriendActionsMenu onDelete={onDelete} onMessage={onMessage} onChallenge={onChallenge} onBlock={onBlock} />)
    const buttons = screen.getAllByRole('button')
    await userEvent.click(buttons[0])
    expect(screen.getByText(/Delete Friend/)).toBeTruthy()
    expect(screen.getByText(/Send Message/)).toBeTruthy()
    expect(screen.getByText(/Challenge/)).toBeTruthy()
    expect(screen.getByText(/Block User/)).toBeTruthy()
  })

  it('calls onDelete when delete is clicked', async () => {
    render(<FriendActionsMenu onDelete={onDelete} onMessage={onMessage} onChallenge={onChallenge} onBlock={onBlock} />)
    const buttons = screen.getAllByRole('button')
    await userEvent.click(buttons[0])
    await userEvent.click(screen.getByText(/Delete Friend/))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('calls onMessage when send message is clicked', async () => {
    render(<FriendActionsMenu onDelete={onDelete} onMessage={onMessage} onChallenge={onChallenge} onBlock={onBlock} />)
    const buttons = screen.getAllByRole('button')
    await userEvent.click(buttons[0])
    await userEvent.click(screen.getByText(/Send Message/))
    expect(onMessage).toHaveBeenCalledTimes(1)
  })

  it('calls onChallenge when challenge is clicked', async () => {
    render(<FriendActionsMenu onDelete={onDelete} onMessage={onMessage} onChallenge={onChallenge} onBlock={onBlock} />)
    const buttons = screen.getAllByRole('button')
    await userEvent.click(buttons[0])
    await userEvent.click(screen.getByText(/Challenge/))
    expect(onChallenge).toHaveBeenCalledTimes(1)
  })

  it('calls onBlock when block user is clicked', async () => {
    render(<FriendActionsMenu onDelete={onDelete} onMessage={onMessage} onChallenge={onChallenge} onBlock={onBlock} />)
    const buttons = screen.getAllByRole('button')
    await userEvent.click(buttons[0])
    await userEvent.click(screen.getByText(/Block User/))
    expect(onBlock).toHaveBeenCalledTimes(1)
  })
})
