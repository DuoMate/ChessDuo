import fs from 'fs'
import path from 'path'

const PAGES_THAT_MUST_USE_PAGE_LOADING = [
  'src/app/game/page.tsx',
  'src/app/duel/page.tsx',
  'src/app/replay/[gameId]/client.tsx',
  'src/app/(main)/four-player/page.tsx',
  'src/app/(main)/history/page.tsx',
  'src/app/challenge/[code]/client.tsx',
  'src/app/invite/[userId]/client.tsx',
  'src/app/page.tsx',
  'src/features/auth/AuthGate.tsx',
  'src/app/(main)/premium/page.tsx',
  'src/app/(main)/delete-account/page.tsx',
]

const LOADING_TSX_FILES = [
  'src/app/(main)/loading.tsx',
  'src/app/invite/[userId]/loading.tsx',
  'src/app/challenge/[code]/loading.tsx',
  'src/app/replay/[gameId]/loading.tsx',
]

describe('PageLoading — architectural enforcement', () => {
  const rootDir = path.resolve(__dirname, '../../..')

  it.each(PAGES_THAT_MUST_USE_PAGE_LOADING)(
    'page %s imports PageLoading from the centralized component',
    (filePath) => {
      const fullPath = path.join(rootDir, filePath)
      expect(fs.existsSync(fullPath)).toBe(true)
      const content = fs.readFileSync(fullPath, 'utf-8')
      expect(content).toContain("from '@/components/PageLoading'")
    }
  )

  it.each(LOADING_TSX_FILES)(
    'loading.tsx %s imports PageLoading from the centralized component',
    (filePath) => {
      const fullPath = path.join(rootDir, filePath)
      expect(fs.existsSync(fullPath)).toBe(true)
      const content = fs.readFileSync(fullPath, 'utf-8')
      expect(content).toContain("from '@/components/PageLoading'")
    }
  )

  it('no legacy ChessLoader function remains in premium page', () => {
    const premiumPath = path.join(rootDir, 'src/app/(main)/premium/page.tsx')
    const content = fs.readFileSync(premiumPath, 'utf-8')
    expect(content).not.toContain('function ChessLoader')
  })

  it('Spinner.tsx has the label prop (used by PageLoading)', () => {
    const spinnerPath = path.join(rootDir, 'src/components/Spinner.tsx')
    const content = fs.readFileSync(spinnerPath, 'utf-8')
    expect(content).toContain('label?: ReactNode')
  })

  it('PageLoading.tsx has default export', () => {
    const pageLoadingPath = path.join(rootDir, 'src/components/PageLoading.tsx')
    const content = fs.readFileSync(pageLoadingPath, 'utf-8')
    expect(content).toContain('export function PageLoading')
  })

  it('no page-level loading in game/page.tsx uses inline Spinner div', () => {
    const gamePath = path.join(rootDir, 'src/app/game/page.tsx')
    const content = fs.readFileSync(gamePath, 'utf-8')
    // PageLoading is used, but Spinner import is removed from game/page.tsx
    expect(content).toContain("from '@/components/PageLoading'")
    expect(content).not.toContain("from '@/components/Spinner'")
  })

  it('no page-level loading in duel/page.tsx uses inline Spinner div', () => {
    const duelPath = path.join(rootDir, 'src/app/duel/page.tsx')
    const content = fs.readFileSync(duelPath, 'utf-8')
    expect(content).toContain("from '@/components/PageLoading'")
    expect(content).not.toContain("from '@/components/Spinner'")
  })

  it('no page-level loading in replay client uses inline Spinner div', () => {
    const replayPath = path.join(rootDir, 'src/app/replay/[gameId]/client.tsx')
    const content = fs.readFileSync(replayPath, 'utf-8')
    expect(content).toContain("from '@/components/PageLoading'")
    expect(content).not.toContain("from '@/components/Spinner'")
  })

  it('no page-level loading in four-player page uses inline Spinner div', () => {
    const fourPlayerPath = path.join(rootDir, 'src/app/(main)/four-player/page.tsx')
    const content = fs.readFileSync(fourPlayerPath, 'utf-8')
    expect(content).toContain("from '@/components/PageLoading'")
    expect(content).not.toContain("from '@/components/Spinner'")
  })

  it('no page-level loading in AuthGate uses inline Spinner div', () => {
    const authGatePath = path.join(rootDir, 'src/features/auth/AuthGate.tsx')
    const content = fs.readFileSync(authGatePath, 'utf-8')
    expect(content).toContain("from '@/components/PageLoading'")
    expect(content).not.toContain("from '@/components/Spinner'")
  })

  it('home page.tsx has creatingTime feedback (Gap 1 fix)', () => {
    const homePath = path.join(rootDir, 'src/app/page.tsx')
    const content = fs.readFileSync(homePath, 'utf-8')
    // Must import PageLoading
    expect(content).toContain("from '@/components/PageLoading'")
    // Must show feedback when creatingTime is set
    expect(content).toContain('Creating room...')
    expect(content).toContain('creatingTime')
  })
})
