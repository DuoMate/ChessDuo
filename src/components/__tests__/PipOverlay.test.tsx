import { renderToStaticMarkup } from 'react-dom/server'
import { PipOverlay, parsePipBoard } from '../PipOverlay'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('parsePipBoard', () => {
  it('parses the starting position (white orientation)', () => {
    const grid = parsePipBoard(START_FEN, 'white')
    expect(grid).toHaveLength(8)
    expect(grid[0]).toEqual(['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'])
    expect(grid[1]).toEqual(Array(8).fill('p'))
    expect(grid[2]).toEqual(Array(8).fill(null))
    expect(grid[6]).toEqual(Array(8).fill('P'))
    expect(grid[7]).toEqual(['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'])
  })

  it('flips the board for the black viewer', () => {
    const grid = parsePipBoard(START_FEN, 'black')
    expect(grid[0]).toEqual(['R', 'N', 'B', 'K', 'Q', 'B', 'N', 'R'])
    expect(grid[7]).toEqual(['r', 'n', 'b', 'k', 'q', 'b', 'n', 'r'])
  })

  it('reflects a mid-game position from the live FEN', () => {
    const grid = parsePipBoard('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', 'white')
    expect(grid[4][4]).toBe('P')
    expect(grid[6][4]).toBeNull()
  })

  it('returns an empty board (never throws) for malformed FEN', () => {
    const grid = parsePipBoard('not-a-fen', 'white')
    expect(grid).toHaveLength(8)
    expect(grid.flat().every((c) => c === null)).toBe(true)
  })
})

describe('PipOverlay', () => {
  it('renders nothing when not visible', () => {
    const html = renderToStaticMarkup(
      <PipOverlay visible={false} fen={START_FEN} turnLabel="YOUR TURN" gameLabel="DUO" />,
    )
    expect(html).toBe('')
  })

  it('renders brand, board, turn status, timer, and game identity', () => {
    const html = renderToStaticMarkup(
      <PipOverlay
        visible
        fen={START_FEN}
        turnLabel="YOUR TURN"
        gameLabel="DUO"
        getTimeRemaining={() => 272}
        isTimerActive
        totalSeconds={600}
      />,
    )
    expect(html).toContain('CHESSDUO')
    expect(html).toContain('YOUR TURN')
    expect(html).toContain('DUO')
    expect(html).toContain('4:32')
    // 64 squares + back-rank glyphs present (filled glyphs; side shown via text color)
    expect(html).toContain('♜')
    expect(html).toContain('♚')
  })

  it('renders a footer label instead of a timer for untimed modes', () => {
    const html = renderToStaticMarkup(
      <PipOverlay visible fen={START_FEN} turnLabel="YOUR TURN" gameLabel="AI COACH" footerLabel="Move 7" />,
    )
    expect(html).toContain('Move 7')
    expect(html).toContain('AI COACH')
  })

  it('hides menus, chat, insights, and navigation chrome', () => {
    const html = renderToStaticMarkup(
      <PipOverlay visible fen={START_FEN} turnLabel="OPPONENT'S TURN" gameLabel="QUICK PLAY" footerLabel="Move 3" />,
    )
    expect(html.toLowerCase()).not.toContain('chat')
    expect(html.toLowerCase()).not.toContain('insight')
    expect(html.toLowerCase()).not.toContain('surrender')
    expect(html.toLowerCase()).not.toContain('resign')
  })
})
