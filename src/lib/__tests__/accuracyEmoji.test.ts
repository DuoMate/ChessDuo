import { getAccuracyCategory } from '../../features/shared/accuracy'

describe('getAccuracyCategory — emoji cleanup', () => {
  it('Perfect has no emoji', () => {
    const cat = getAccuracyCategory(5)
    expect(cat.label).toBe('Perfect')
    expect(cat.emoji).toBe('')
    expect(cat.color).toBe('#22c55e')
  })

  it('Great has no emoji', () => {
    const cat = getAccuracyCategory(20)
    expect(cat.label).toBe('Great')
    expect(cat.emoji).toBe('')
    expect(cat.color).toBe('#22c55e')
  })

  it('Good has no emoji', () => {
    const cat = getAccuracyCategory(50)
    expect(cat.label).toBe('Good')
    expect(cat.emoji).toBe('')
    expect(cat.color).toBe('#84cc16')
  })

  it('Inaccuracy has warning icon', () => {
    const cat = getAccuracyCategory(100)
    expect(cat.label).toBe('Inaccuracy')
    expect(cat.emoji).toBe('⚠ ')
    expect(cat.color).toBe('#eab308')
  })

  it('Mistake has cross icon', () => {
    const cat = getAccuracyCategory(200)
    expect(cat.label).toBe('Mistake')
    expect(cat.emoji).toBe('✗ ')
    expect(cat.color).toBe('#ef4444')
  })

  it('does not use chess annotation symbols (?, ??, !, !!)', () => {
    const cats = [
      getAccuracyCategory(5),
      getAccuracyCategory(20),
      getAccuracyCategory(50),
      getAccuracyCategory(100),
      getAccuracyCategory(200),
    ]
    for (const cat of cats) {
      expect(cat.emoji).not.toBe('?')
      expect(cat.emoji).not.toBe('??')
      expect(cat.emoji).not.toBe('!')
      expect(cat.emoji).not.toBe('!!!')
      expect(cat.emoji).not.toBe('✓')
    }
  })
})
