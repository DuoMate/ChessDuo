import { generateRoomCode } from '../Room'

describe('generateRoomCode', () => {
  it('should return a string', () => {
    const code = generateRoomCode()
    expect(typeof code).toBe('string')
  })

  it('should return a 6-character code', () => {
    const code = generateRoomCode()
    expect(code.length).toBe(6)
  })

  it('should only contain valid characters', () => {
    const validChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const code = generateRoomCode()
    
    for (const char of code) {
      expect(validChars.includes(char)).toBe(true)
    }
  })

  it('should not contain confusing characters (I, O, 0, 1)', () => {
    const code = generateRoomCode()
    
    expect(code).not.toMatch(/[IO01]/)
  })

  it('should generate different codes on each call', () => {
    const code1 = generateRoomCode()
    const code2 = generateRoomCode()
    
    // There's a very small chance they could be the same, but very unlikely
    expect(code1).not.toBe(code2)
  })
})
