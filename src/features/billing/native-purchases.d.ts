declare module '@capgo/native-purchases' {
  interface NativePurchasesPlugin {
    getProducts(options: { productIdentifiers: string[]; productType: string }): Promise<{ products: unknown[] }>
    purchaseProduct(options: { productIdentifier: string; productType: string }): Promise<unknown>
    restorePurchases(): Promise<void>
  }
  export const NativePurchases: NativePurchasesPlugin
}
