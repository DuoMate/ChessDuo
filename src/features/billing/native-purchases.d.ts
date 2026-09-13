declare module '@capgo/native-purchases' {
  interface NativePurchasesPlugin {
    getProducts(options: { productIdentifiers: string[]; productType: string }): Promise<{ products: unknown[] }>
    getPurchases?(options: { productType: string }): Promise<{ purchases: unknown[] }>
    purchaseProduct(options: { productIdentifier: string; productType: string; planIdentifier?: string; offerToken?: string }): Promise<unknown>
    restorePurchases(): Promise<{ purchases?: unknown[] } | void>
  }
  export const NativePurchases: NativePurchasesPlugin
}
