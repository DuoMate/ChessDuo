/**
 * Sound engine tests — uses a mocked Web Audio API to verify routing
 * through the master gain + compressor chain and the raised gain levels.
 */

type AudioParamMock = {
  value: number
  setValueAtTime: jest.Mock
  linearRampToValueAtTime: jest.Mock
  exponentialRampToValueAtTime: jest.Mock
}

type AudioNodeMock = {
  connect: jest.Mock
}

function makeParam(initial: number): AudioParamMock {
  return {
    value: initial,
    setValueAtTime: jest.fn(),
    linearRampToValueAtTime: jest.fn(),
    exponentialRampToValueAtTime: jest.fn(),
  }
}

function makeNode(): AudioNodeMock & Record<string, any> {
  return {
    connect: jest.fn(),
    type: '',
    frequency: makeParam(0),
    Q: makeParam(0),
    gain: makeParam(0),
    threshold: makeParam(0),
    knee: makeParam(0),
    ratio: makeParam(0),
    attack: makeParam(0),
    release: makeParam(0),
    buffer: null,
    start: jest.fn(),
    stop: jest.fn(),
  }
}

const createdNodes: Array<AudioNodeMock & Record<string, any>> = []
const destination = makeNode()
const destinations: AudioNodeMock[] = []

class MockAudioContext {
  currentTime = 0
  sampleRate = 44100
  state: AudioContextState = 'running'
  destination = destination

  createGain() {
    const node = makeNode()
    createdNodes.push(node)
    return node
  }

  createBuffer(_channels: number, _length: number) {
    return { getChannelData: () => new Float32Array(_length) }
  }

  createBufferSource() {
    const node = makeNode()
    createdNodes.push(node)
    return node
  }

  createBiquadFilter() {
    const node = makeNode()
    createdNodes.push(node)
    return node
  }

  createOscillator() {
    const node = makeNode()
    createdNodes.push(node)
    return node
  }

  createDynamicsCompressor() {
    const node = makeNode()
    createdNodes.push(node)
    return node
  }

  resume() {
    return Promise.resolve()
  }
}

describe('SoundEngine', () => {
  let soundEngine: typeof import('../sounds').soundEngine
  let playMoveSound: typeof import('../sounds').playMoveSound
  let playCaptureSound: typeof import('../sounds').playCaptureSound
  let setSoundEnabled: typeof import('../sounds').setSoundEnabled

  beforeEach(() => {
    jest.resetModules()
    createdNodes.length = 0
    destinations.length = 0
    ;(window as any).AudioContext = MockAudioContext
    ;(window as any).webkitAudioContext = MockAudioContext
    destination.connect = jest.fn()

    const sounds = require('../sounds')
    soundEngine = sounds.soundEngine
    playMoveSound = sounds.playMoveSound
    playCaptureSound = sounds.playCaptureSound
    setSoundEnabled = sounds.setSoundEnabled
  })

  function routeTargets(): (AudioNodeMock | undefined)[] {
    // Every node that isn't the master gain / compressor should connect to master gain (or destination fallback).
    return createdNodes.map((node) => {
      const target = node.connect.mock.calls[0]?.[0] as AudioNodeMock | undefined
      if (target && 'connect' in target) {
        destinations.push(target)
      }
      return target
    })
  }

  function findMasterGain(): AudioNodeMock & Record<string, any> | undefined {
    return createdNodes.find((node) => node.gain && node.gain.value === 1.0)
  }

  function findCompressor(): AudioNodeMock & Record<string, any> | undefined {
    return createdNodes.find((node) => node.threshold && node.threshold.value === -18)
  }

  it('plays move sound and routes it through the master gain chain', () => {
    playMoveSound()

    const masterGain = findMasterGain()
    const compressor = findCompressor()
    expect(masterGain).toBeDefined()
    expect(compressor).toBeDefined()
    expect(masterGain!.connect).toHaveBeenCalledWith(compressor)
    expect(compressor!.connect).toHaveBeenCalledWith(destination)

    // Every sound node should route to the master gain (never straight to destination).
    const badSinks = createdNodes
      .filter((node) => node !== masterGain && node !== compressor)
      .filter((node) => node.connect.mock.calls.some((c: unknown[]) => c[0] === destination))
    expect(badSinks).toHaveLength(0)

    const routed = createdNodes
      .filter((node) => node !== masterGain && node !== compressor)
      .filter((node) => node.connect.mock.calls.some((c: unknown[]) => c[0] === masterGain))
    expect(routed.length).toBeGreaterThan(0)
  })

  it('uses louder gain levels for the move sound', () => {
    playMoveSound()

    const gains = createdNodes
      .map((node) => node.gain)
      .filter((param) => param)
      .map((param) => param.setValueAtTime.mock.calls.map((c: unknown[]) => c[0] as number))
      .flat()

    const peak = Math.max(...gains)
    // Previous peak was 0.6 (thud); move sound must now be louder.
    expect(peak).toBeGreaterThan(0.6)
  })

  it('plays capture sound with louder gains', () => {
    playCaptureSound()

    const gains = createdNodes
      .map((node) => node.gain)
      .filter((param) => param)
      .map((param) => param.setValueAtTime.mock.calls.map((c: unknown[]) => c[0] as number))
      .flat()

    const peak = Math.max(...gains)
    // Previous capture peak was 0.35.
    expect(peak).toBeGreaterThan(0.35)
  })

  it('does not play when disabled', () => {
    setSoundEnabled(false)
    playMoveSound()

    // No audio nodes created means nothing was played.
    expect(createdNodes).toHaveLength(0)
  })

  it('plays again after being re-enabled', () => {
    setSoundEnabled(false)
    playMoveSound()
    expect(createdNodes).toHaveLength(0)

    setSoundEnabled(true)
    playMoveSound()
    expect(createdNodes.length).toBeGreaterThan(0)
  })
})
