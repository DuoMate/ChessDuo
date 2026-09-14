describe('Android Capacitor sync setup', () => {
  it('builds the static export before syncing the Android project', () => {
    const pkg = require('../../package.json')

    expect(pkg.scripts['cap:sync']).toContain('NEXT_OUTPUT=export npx next build')
    expect(pkg.scripts['cap:sync']).toContain('npx cap sync android')
  })
})
