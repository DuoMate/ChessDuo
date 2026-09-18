import { render, screen, fireEvent } from '@testing-library/react'
import { UpdatePrompt } from '../UpdatePrompt'

describe('UpdatePrompt', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <UpdatePrompt open={false} onUpdate={() => {}} onLater={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the optional-update copy with Update and Later actions', () => {
    const onUpdate = jest.fn()
    const onLater = jest.fn()
    render(<UpdatePrompt open onUpdate={onUpdate} onLater={onLater} />)

    expect(
      screen.getByRole('dialog', { name: /new version available/i }),
    ).toBeDefined()
    expect(
      screen.getByText(/improvements and fixes/i),
    ).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Update' }))
    fireEvent.click(screen.getByRole('button', { name: 'Later' }))
    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onLater).toHaveBeenCalledTimes(1)
  })

  it('renders release notes when provided', () => {
    render(
      <UpdatePrompt
        open
        notes="Bug fixes"
        onUpdate={() => {}}
        onLater={() => {}}
      />,
    )
    expect(screen.getByText('Bug fixes')).toBeDefined()
  })
})
