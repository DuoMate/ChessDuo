/**
 * Sound effects using Web Audio API — chess.com-style synthesized sounds.
 * No external audio files needed.
 */

import { DEBUG } from './debug'

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
      this.getContext().resume().catch(() => {})
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  resumeContext(): Promise<void> {
    return this.getContext().resume()
  }

  getState(): AudioContextState | 'uninitialized' {
    return this.audioContext?.state ?? 'uninitialized'
  }

  play(sound: SoundType) {
    if (!this.enabled) return

    this.ensureInitialized()

    try {
      const ctx = this.getContext()

      const trigger = () => {
        try {
          switch (sound) {
            case 'move': this.playMoveSound(ctx); break
            case 'capture': this.playCaptureSound(ctx); break
            case 'check': this.playCheckSound(ctx); break
            case 'checkmate': this.playCheckmateSound(ctx); break
            case 'illegal': this.playIllegalSound(ctx); break
            case 'lock': this.playLockSound(ctx); break
            case 'resolution': this.playResolutionSound(ctx); break
          }
          DEBUG && console.log('[Sound] Played:', sound)
        } catch (e) {
          DEBUG && console.log('[Sound] Play error:', sound, e)
        }
      }

      // Always trigger immediately — Web Audio buffers until context resumes.
      // Do NOT block on resume() as it may never resolve without a user gesture.
      trigger()

      // Best-effort resume in background
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {})
      }
    } catch (e) {
      DEBUG && console.log('[Sound] Not available:', e)
    }
  }

  // ─── Move: short wooden click — filtered noise burst + impulse ───
  private playMoveSound(ctx: AudioContext) {
    const now = ctx.currentTime

    // Noise burst for the wooden "click"
    const noiseLen = ctx.sampleRate * 0.04 // 40ms
    const noiseBuffer = ctx.createBuffer(1, noiseLen, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < noiseLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.008))
    }

    const noise = ctx.createBufferSource()
    noise.buffer = noiseBuffer

    const bandpass = ctx.createBiquadFilter()
    bandpass.type = 'bandpass'
    bandpass.frequency.setValueAtTime(2000, now)
    bandpass.Q.setValueAtTime(0.8, now)

    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(0.2, now)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04)

    noise.connect(bandpass)
    bandpass.connect(noiseGain)
    noiseGain.connect(ctx.destination)
    noise.start(now)
    noise.stop(now + 0.04)

    // Low thud
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(120, now)

    const thudGain = ctx.createGain()
    thudGain.gain.setValueAtTime(0.4, now)
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)

    osc.connect(thudGain)
    thudGain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.06)
  }

  // ─── Capture: louder thud + high click ───
  private playCaptureSound(ctx: AudioContext) {
    const now = ctx.currentTime

    // Two quick taps
    for (let tap = 0; tap < 2; tap++) {
      const t = now + tap * 0.05

      const noiseLen = ctx.sampleRate * 0.03
      const noiseBuffer = ctx.createBuffer(1, noiseLen, ctx.sampleRate)
      const data = noiseBuffer.getChannelData(0)
      for (let i = 0; i < noiseLen; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.005))
      }

      const noise = ctx.createBufferSource()
      noise.buffer = noiseBuffer

      const bandpass = ctx.createBiquadFilter()
      bandpass.type = 'bandpass'
      bandpass.frequency.setValueAtTime(1500 + tap * 500, t)
      bandpass.Q.setValueAtTime(0.5, t)

      const noiseGain = ctx.createGain()
      noiseGain.gain.setValueAtTime(0.18, t)
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04)

      noise.connect(bandpass)
      bandpass.connect(noiseGain)
      noiseGain.connect(ctx.destination)
      noise.start(t)
      noise.stop(t + 0.04)

      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(80 - tap * 20, t)

      const thudGain = ctx.createGain()
      thudGain.gain.setValueAtTime(0.35, t)
      thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08)

      osc.connect(thudGain)
      thudGain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.08)
    }
  }

  // ─── Check: two-tone alert ───
  private playCheckSound(ctx: AudioContext) {
    const now = ctx.currentTime

    const tones = [523, 659] as const // C5, E5
    tones.forEach((freq, i) => {
      const t = now + i * 0.1

      const osc = ctx.createOscillator()
      osc.type = 'square'
      osc.frequency.setValueAtTime(freq, t)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.08, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.12)
    })
  }

  // ─── Checkmate: ascending victory chord ───
  private playCheckmateSound(ctx: AudioContext) {
    const now = ctx.currentTime
    const notes = [523, 659, 784, 1047] as const // C5, E5, G5, C6

    notes.forEach((freq, i) => {
      const t = now + i * 0.15

      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, t)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.15, t + 0.03)
      gain.gain.setValueAtTime(0.15, t + 0.1)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.35)
    })

    // Final bell
    const bell = ctx.createOscillator()
    bell.type = 'sine'
    bell.frequency.setValueAtTime(1047, now + 0.6)

    const bellGain = ctx.createGain()
    bellGain.gain.setValueAtTime(0, now + 0.6)
    bellGain.gain.linearRampToValueAtTime(0.2, now + 0.62)
    bellGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2)

    bell.connect(bellGain)
    bellGain.connect(ctx.destination)
    bell.start(now + 0.6)
    bell.stop(now + 1.2)
  }

  // ─── Illegal: low buzz ───
  private playIllegalSound(ctx: AudioContext) {
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.setValueAtTime(110, now)
    osc.frequency.linearRampToValueAtTime(80, now + 0.15)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.1, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.18)
  }

  // ─── Lock: quick confirm click ───
  private playLockSound(ctx: AudioContext) {
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, now)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.08, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.06)
  }

  // ─── Resolution: short success chime ───
  private playResolutionSound(ctx: AudioContext) {
    const now = ctx.currentTime
    const freqs = [523, 659, 784] as const // C-E-G chord

    freqs.forEach((freq, i) => {
      const t = now + i * 0.08
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, t)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.1, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.2)
    })
  }
}

export const soundEngine = new SoundEngine()

export const playMoveSound = () => soundEngine.play('move')
export const playCaptureSound = () => soundEngine.play('capture')
export const playCheckSound = () => soundEngine.play('check')
export const playCheckmateSound = () => soundEngine.play('checkmate')
export const playIllegalSound = () => soundEngine.play('illegal')
export const playLockSound = () => soundEngine.play('lock')
export const playResolutionSound = () => soundEngine.play('resolution')

export const setSoundEnabled = (enabled: boolean) => soundEngine.setEnabled(enabled)
