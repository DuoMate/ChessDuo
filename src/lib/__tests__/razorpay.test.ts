import { getRazorpay } from '../razorpay'

const OLD_ENV = process.env

beforeEach(() => {
  jest.resetModules()
  process.env = { ...OLD_ENV }
  // Clear the singleton between tests
  const mod = require('../razorpay')
  delete mod._razorpayInstance
})

afterAll(() => {
  process.env = OLD_ENV
})

describe('getRazorpay', () => {
  test('throws when RAZORPAY_KEY_ID is missing', () => {
    delete process.env.RAZORPAY_KEY_ID
    process.env.RAZORPAY_KEY_SECRET = 'test_secret'
    const { getRazorpay } = require('../razorpay')
    expect(() => getRazorpay()).toThrow(/RAZORPAY_KEY_ID/)
  })

  test('throws when RAZORPAY_KEY_SECRET is missing', () => {
    process.env.RAZORPAY_KEY_ID = 'test_key_id'
    delete process.env.RAZORPAY_KEY_SECRET
    const { getRazorpay } = require('../razorpay')
    expect(() => getRazorpay()).toThrow(/RAZORPAY_KEY_SECRET/)
  })

  test('returns a Razorpay instance when both env vars are set', () => {
    process.env.RAZORPAY_KEY_ID = 'test_key_id'
    process.env.RAZORPAY_KEY_SECRET = 'test_secret'
    const { getRazorpay } = require('../razorpay')
    const instance = getRazorpay()
    expect(instance).toBeDefined()
  })

  test('returns the same instance on second call', () => {
    process.env.RAZORPAY_KEY_ID = 'test_key_id'
    process.env.RAZORPAY_KEY_SECRET = 'test_secret'
    const { getRazorpay } = require('../razorpay')
    const a = getRazorpay()
    const b = getRazorpay()
    expect(a).toBe(b)
  })
})
