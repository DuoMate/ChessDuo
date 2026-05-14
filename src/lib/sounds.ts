/**
 * Sound effects using Web Audio API
 * No external audio files needed - generates sounds programmatically
 */

type SoundType = 'move' | 'capture' | 'check' | 'checkmate' | 'illegal' | 'lock' | 'resolution'

class SoundEngine {
  private audioContext: AudioContext | null = null
  private enabled: boolean = true
  private initialized: boolean = false

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    return this.audioContext
  }

  private ensureInitialized() {
    if (!this.initialized) {
      this.initialized = true
      // Resume context if suspended (browser autoplay policy)
      this.getContext().resume().catch(() => {})
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  play(sound: SoundType) {
    if (!this.enabled) return

    this.ensureInitialized()

    try {
      const ctx = this.getContext()
      
      switch (sound) {
        case 'move':
          this.playMoveSound(ctx)
          break
        case 'capture':
          this.playCaptureSound(ctx)
          break
        case 'check':
          this.playCheckSound(ctx)
          break
        case 'checkmate':
          this.playCheckmateSound(ctx)
          break
        case 'illegal':
          this.playIllegalSound(ctx)
          break
        case 'lock':
          this.playLockSound(ctx)
          break
        case 'resolution':
          this.playResolutionSound(ctx)
          break
      }
    } catch (e) {
      // Silently fail if audio not available
      console.log('[Sound] Not available:', e)
    }
  }

  private playMoveSound(ctx: AudioContext) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    
    osc.connect(gain)
    gain.connect(ctx.destination)
    
    osc.frequency.setValueAtTime(300, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.1)
    
    gain.gain.setValueAtTime(0.1, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1)
    
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.1)
  }

  private playCaptureSound(ctx: AudioContext) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    
    osc.connect(gain)
    gain.connect(ctx.destination)
    
    // Impact sound - lower frequency
    osc.frequency.setValueAtTime(150, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.2)
    
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2)
    
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.2)
  }

  private playCheckSound(ctx: AudioContext) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    
    osc.connect(gain)
    gain.connect(ctx.destination)
    
    // Rising alert tone
    osc.frequency.setValueAtTime(400, ctx.currentTime)
    osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.15)
    osc.frequency.linearRampToValueAtTime(400, ctx.currentTime + 0.3)
    osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.45)
    
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.45)
    
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.45)
  }

  private playCheckmateSound(ctx: AudioContext) {
    const duration = 0.8
    const notes = [523, 659, 784, 1047] // C5, E5, G5, C6
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      
      osc.connect(gain)
      gain.connect(ctx.destination)
      
      const startTime = ctx.currentTime + i * 0.15
      
      osc.frequency.setValueAtTime(freq, startTime)
      gain.gain.setValueAtTime(0.2, startTime)
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3)
      
      osc.start(startTime)
      osc.stop(startTime + 0.3)
    })
  }

  private playIllegalSound(ctx: AudioContext) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    
    osc.connect(gain)
    gain.connect(ctx.destination)
    
    // Low buzz
    osc.type = 'square'
    osc.frequency.setValueAtTime(100, ctx.currentTime)
    osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.15)
    
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)
    
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.15)
  }

  private playLockSound(ctx: AudioContext) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    
    osc.connect(gain)
    gain.connect(ctx.destination)
    
    // Quick confirmation beep
    osc.frequency.setValueAtTime(800, ctx.currentTime)
    
    gain.gain.setValueAtTime(0.1, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05)
    
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.05)
  }

  private playResolutionSound(ctx: AudioContext) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    
    osc.connect(gain)
    gain.connect(ctx.destination)
    
    // Triumphant chord
    osc.frequency.setValueAtTime(440, ctx.currentTime) // A4
    osc.frequency.setValueAtTime(554, ctx.currentTime + 0.1) // C#5
    osc.frequency.setValueAtTime(659, ctx.currentTime + 0.2) // E5
    
    gain.gain.setValueAtTime(0.1, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.4)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
    
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.5)
  }
}

// Singleton instance
export const soundEngine = new SoundEngine()

// Convenience functions
export const playMoveSound = () => soundEngine.play('move')
export const playCaptureSound = () => soundEngine.play('capture')
export const playCheckSound = () => soundEngine.play('check')
export const playCheckmateSound = () => soundEngine.play('checkmate')
export const playIllegalSound = () => soundEngine.play('illegal')
export const playLockSound = () => soundEngine.play('lock')
export const playResolutionSound = () => soundEngine.play('resolution')

export const setSoundEnabled = (enabled: boolean) => soundEngine.setEnabled(enabled)