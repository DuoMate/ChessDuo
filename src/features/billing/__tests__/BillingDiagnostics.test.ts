import { createPluginDiagnostic, formatBillingTrace } from '../GooglePlayBillingProvider'

jest.mock('@capgo/native-purchases', () => ({
  NativePurchases: {},
}), { virtual: true })

describe('billing plugin diagnostics', () => {
  it('formats a bounded safe trace for the technical details popup', () => {
    expect(formatBillingTrace([
      { event: 'provider_module_loaded', elapsedMs: 1 },
      { event: 'plugin_lookup_start', elapsedMs: 4, detail: 'name=NativePurchases' },
    ])).toBe('1. provider_module_loaded elapsedMs=1\n2. plugin_lookup_start elapsedMs=4 name=NativePurchases')
  })

  it('preserves runtime context while redacting sensitive error values', () => {
    const diagnostic = createPluginDiagnostic({
      code: 'js_import_failed',
      platform: 'android',
      nativePlatform: true,
      elapsedMs: 184,
      pluginExportPresent: false,
      error: new Error('authorization=secret purchaseToken=private'),
    })

    expect(diagnostic.code).toBe('js_import_failed')
    expect(diagnostic.details).toContain('platform=android')
    expect(diagnostic.details).toContain('nativePlatform=true')
    expect(diagnostic.details).toContain('pluginExportPresent=false')
    expect(diagnostic.details).toContain('elapsedMs=184')
    expect(diagnostic.details).toContain('authorization=[redacted]')
    expect(diagnostic.details).toContain('purchaseToken=[redacted]')
    expect(diagnostic.details).not.toContain('secret')
    expect(diagnostic.details).not.toContain('private')
  })
})
