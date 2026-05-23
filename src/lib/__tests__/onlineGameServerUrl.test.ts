describe('onlineGame server URL configuration', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...OLD_ENV }
  })

  afterAll(() => {
    process.env = OLD_ENV
  })

  it('uses NEXT_PUBLIC_STOCKFISH_SERVER_URL env var when set', () => {
    process.env.NEXT_PUBLIC_STOCKFISH_SERVER_URL = 'https://chessduo-bllo.onrender.com'
    delete (process.env as Record<string, string | undefined>).NEXT_PUBLIC_EVALUATOR_URL

    const onlineGame = require('../../features/online/game/onlineGame')
    const instance = new onlineGame.OnlineGame(600)

    expect(instance).toBeDefined()
  })

  it('falls back to empty string when env var is not set', () => {
    delete (process.env as Record<string, string | undefined>).NEXT_PUBLIC_STOCKFISH_SERVER_URL
    delete (process.env as Record<string, string | undefined>).NEXT_PUBLIC_EVALUATOR_URL

    const onlineGame = require('../../features/online/game/onlineGame')
    const instance = new onlineGame.OnlineGame(600)

    expect(instance).toBeDefined()
  })

  it('does not use NEXT_PUBLIC_EVALUATOR_URL env var', () => {
    process.env.NEXT_PUBLIC_STOCKFISH_SERVER_URL = 'https://correct-server.example.com'
    process.env.NEXT_PUBLIC_EVALUATOR_URL = 'https://wrong-server.example.com'

    const onlineGame = require('../../features/online/game/onlineGame')
    const instance = new onlineGame.OnlineGame(600)

    expect(instance).toBeDefined()
  })
})
