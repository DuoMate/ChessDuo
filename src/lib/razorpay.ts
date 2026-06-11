import Razorpay from 'razorpay'

let razorpayInstance: Razorpay | null = null

export function getRazorpay(): Razorpay {
  if (razorpayInstance) return razorpayInstance

  const keyId = process.env.RAZORPAY_KEY_ID || ''
  const keySecret = process.env.RAZORPAY_KEY_SECRET || ''

  if (!keyId || !keySecret) {
    throw new Error('[Razorpay] Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET environment variables')
  }

  razorpayInstance = new Razorpay({ key_id: keyId, key_secret: keySecret })
  return razorpayInstance
}
