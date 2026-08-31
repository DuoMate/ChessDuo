import { Capacitor } from '@capacitor/core'
import { TextToSpeech } from '@capacitor-community/text-to-speech'

/**
 * Optional Coach Mode voice. Independent of the game loop — if TTS is
 * unavailable, `speak()` silently no-ops and the game continues unchanged.
 *
 * - Android / Capacitor: native `@capacitor-community/text-to-speech`.
 * - Web: `window.speechSynthesis`.
 */

type VoiceStateListener = (enabled: boolean) => void

class CoachVoiceService {
  private enabled = false
  private listeners = new Set<VoiceStateListener>()

  isNative(): boolean {
    try {
      return typeof window !== 'undefined' && !!Capacitor.isNativePlatform()
    } catch {
      return false
    }
  }

  isSupported(): boolean {
    if (this.isNative()) return true
    return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined'
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    this.notify()
  }

  isEnabled(): boolean {
    return this.enabled
  }

  subscribe(fn: VoiceStateListener): () => void {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn(this.enabled))
  }

  async speak(text: string): Promise<void> {
    if (!this.enabled || !text) return
    if (this.isNative()) {
      try {
        await TextToSpeech.speak({ text, lang: 'en-US', rate: 1.0 })
        return
      } catch {
        // Native TTS unavailable — fall through to web synthesis.
      }
    }
    this.webSpeak(text)
  }

  async stop(): Promise<void> {
    if (this.isNative()) {
      try {
        await TextToSpeech.stop()
      } catch {
        // Native TTS already stopped — ignore.
      }
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel()
      } catch {
        // Nothing to cancel — ignore.
      }
    }
  }

  private webSpeak(text: string): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    try {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'en-US'
      utterance.rate = 1
      window.speechSynthesis.speak(utterance)
    } catch {
      // speechSynthesis unavailable — ignore.
    }
  }
}

export const coachVoice = new CoachVoiceService()
