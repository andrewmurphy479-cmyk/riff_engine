import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { SampleLoader, VelocityLayer } from './SampleLoader';
import { GuitarString } from '../engine/types';
import { fretToMidiNote } from './noteMapping';

// Sound pool configuration - one per guitar string for polyphony
const POOL_SIZE = 6;

// Audio generation constants
const SAMPLE_RATE = 44100; // Higher sample rate for better Karplus-Strong quality
const BIT_DEPTH = 16;

interface PooledSound {
  sound: Audio.Sound | null;
  isPlaying: boolean;
  midiNote: number;
  stringIndex: number;
}

// Guitar string to pool index mapping
const STRING_TO_INDEX: Record<GuitarString, number> = {
  'E': 0,
  'A': 1,
  'D': 2,
  'G': 3,
  'B': 4,
  'e': 5,
};

// Cache for generated tone files
const toneCache: Map<string, string> = new Map();

class SamplePlayerImpl {
  private soundPool: (PooledSound | null)[] = new Array(POOL_SIZE).fill(null);
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Clear tone cache to regenerate with current algorithm
    toneCache.clear();

    await SampleLoader.initialize();

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
    } catch (error) {
      console.error('Failed to set audio mode:', error);
    }

    this.isInitialized = true;
  }

  async playNote(
    guitarString: GuitarString,
    fret: number,
    velocity: number = 0.7,
    durationMs: number = 500
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const midiNote = fretToMidiNote(guitarString, fret);
    const stringIndex = STRING_TO_INDEX[guitarString];

    // Stop any currently playing sound on this string
    await this.stopString(stringIndex);

    // Generate and play synthesized tone
    await this.playSynthNote(midiNote, stringIndex, velocity, durationMs);
  }

  private async playSynthNote(
    midiNote: number,
    stringIndex: number,
    volume: number,
    durationMs: number
  ): Promise<void> {
    try {
      // Get or generate the tone file
      const toneUri = await this.getOrCreateTone(midiNote, durationMs);

      // Create and play the sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: toneUri },
        {
          shouldPlay: true,
          volume: Math.min(1, volume),
          isLooping: false,
        }
      );

      // Store in pool
      this.soundPool[stringIndex] = {
        sound,
        isPlaying: true,
        midiNote,
        stringIndex,
      };

      // Set up completion handler
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          this.cleanupSound(stringIndex, midiNote);
        }
      });

    } catch (error) {
      console.error(`Failed to play synth note ${midiNote}:`, error);
    }
  }

  private async getOrCreateTone(midiNote: number, durationMs: number): Promise<string> {
    // Use a standard duration for caching (round to nearest 100ms)
    const cacheDuration = Math.round(durationMs / 100) * 100;
    const cacheKey = `${midiNote}_${cacheDuration}`;

    // Check cache
    const cached = toneCache.get(cacheKey);
    if (cached) {
      // Verify file still exists
      const info = await FileSystem.getInfoAsync(cached);
      if (info.exists) {
        return cached;
      }
    }

    // Generate new tone
    const uri = await this.generateToneFile(midiNote, cacheDuration);
    toneCache.set(cacheKey, uri);
    return uri;
  }

  private async generateToneFile(midiNote: number, durationMs: number): Promise<string> {
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
    const numSamples = Math.floor((durationMs / 1000) * SAMPLE_RATE);

    // Enhanced Karplus-Strong with extended techniques for realistic guitar
    const periodLength = Math.round(SAMPLE_RATE / frequency);

    // Initialize wavetable with realistic pluck excitation
    const wavetable = new Float32Array(periodLength);

    // Pluck position affects harmonic content (picking near bridge = brighter)
    const pluckPosition = 0.13; // ~13% from bridge (typical fingerpicking)
    const pluckWidth = Math.max(2, Math.floor(periodLength * pluckPosition));

    for (let i = 0; i < periodLength; i++) {
      // Create initial excitation with realistic shape
      // Combines filtered noise with a shaped transient
      let excitation = 0;

      // Noise component (filtered for warmth)
      const noise = Math.random() * 2 - 1;

      // Pluck shape - creates the initial transient
      if (i < pluckWidth) {
        const pluckEnv = Math.sin((i / pluckWidth) * Math.PI);
        excitation = pluckEnv * 0.8;
      }

      // Add filtered noise
      excitation += noise * 0.4;

      // Apply pick/finger attack character
      const attackShape = i < periodLength * 0.1
        ? Math.sin((i / (periodLength * 0.1)) * Math.PI * 0.5)
        : 1;
      excitation *= attackShape;

      wavetable[i] = excitation;
    }

    // Pre-filter the excitation for warmth (simple low-pass)
    for (let pass = 0; pass < 2; pass++) {
      let prev = wavetable[0];
      for (let i = 1; i < periodLength; i++) {
        wavetable[i] = prev * 0.3 + wavetable[i] * 0.7;
        prev = wavetable[i];
      }
    }

    // Generate PCM data using extended Karplus-Strong
    const pcmData = new Int16Array(numSamples);

    // String characteristics based on pitch
    const isBasstring = midiNote < 52; // Below E3
    const isTrebleString = midiNote > 59; // Above B3

    // Damping - bass strings ring longer
    const baseDamping = isBasstring ? 0.998 : (isTrebleString ? 0.994 : 0.996);
    const freqFactor = Math.min(1, 150 / frequency);
    const damping = baseDamping - (1 - freqFactor) * 0.002;

    // String stiffness (inharmonicity) - higher for treble strings
    const stiffness = isTrebleString ? 0.0003 : (isBasstring ? 0.00005 : 0.0001);

    // Tone control - bass strings are warmer
    const toneFilter = isBasstring ? 0.45 : (isTrebleString ? 0.65 : 0.55);

    // State variables for filters
    let lpState = 0;
    let apState = 0;

    // Body resonance frequencies (guitar body modes)
    const bodyFreqs = [98, 196, 294]; // Approximate body resonances
    const bodyAmps = [0.015, 0.008, 0.004];
    const bodyDecays = [4, 6, 8];

    for (let i = 0; i < numSamples; i++) {
      const tableIndex = i % periodLength;
      const nextIndex = (i + 1) % periodLength;
      const prevIndex = (tableIndex - 1 + periodLength) % periodLength;

      // Get samples for interpolation
      const s0 = wavetable[prevIndex];
      const s1 = wavetable[tableIndex];
      const s2 = wavetable[nextIndex];

      // Low-pass filter (string damping) - 3-point weighted average
      let filtered = (s0 * 0.2 + s1 * 0.6 + s2 * 0.2) * damping;

      // Tone control (additional low-pass)
      lpState = lpState * (1 - toneFilter) + filtered * toneFilter;
      filtered = lpState;

      // All-pass filter for slight detuning/chorus effect
      const apCoeff = 0.5 - stiffness * (i / numSamples);
      const apOut = apCoeff * (filtered - apState) + wavetable[tableIndex];
      apState = apOut;
      filtered = filtered * 0.7 + apOut * 0.3;

      // Write back to delay line
      wavetable[tableIndex] = filtered;

      // Calculate body resonance
      const t = i / SAMPLE_RATE;
      let bodyRes = 0;
      for (let b = 0; b < bodyFreqs.length; b++) {
        bodyRes += Math.sin(2 * Math.PI * bodyFreqs[b] * t) *
                   bodyAmps[b] * Math.exp(-bodyDecays[b] * t);
      }

      // Mix string and body
      let sample = filtered * 0.85 + bodyRes;

      // Gentle saturation for warmth
      sample = Math.tanh(sample * 1.2) * 0.9;

      // Final output with slight compression
      const envelope = Math.min(1, 1 - Math.exp(-i / (SAMPLE_RATE * 0.002))); // Quick attack
      sample *= envelope;

      pcmData[i] = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    }

    // Apply gentle high-frequency roll-off (post-processing)
    let hpPrev = 0;
    for (let i = 0; i < numSamples; i++) {
      const current = pcmData[i] / 32767;
      const filtered = hpPrev * 0.15 + current * 0.85;
      hpPrev = filtered;
      pcmData[i] = Math.max(-32768, Math.min(32767, Math.floor(filtered * 32767)));
    }

    // Create WAV file
    const wavBuffer = this.createWavBuffer(pcmData);

    // Save to file
    const fileName = `tone_${midiNote}_${durationMs}.wav`;
    const filePath = `${FileSystem.cacheDirectory}${fileName}`;

    const base64Data = this.arrayBufferToBase64(wavBuffer);
    await FileSystem.writeAsStringAsync(filePath, base64Data, {
      encoding: 'base64',
    });

    return filePath;
  }

  private createWavBuffer(pcmData: Int16Array): ArrayBuffer {
    const numChannels = 1;
    const bytesPerSample = 2;
    const dataLength = pcmData.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    // RIFF header
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    this.writeString(view, 8, 'WAVE');

    // fmt sub-chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, SAMPLE_RATE, true);
    view.setUint32(28, SAMPLE_RATE * numChannels * bytesPerSample, true);
    view.setUint16(32, numChannels * bytesPerSample, true);
    view.setUint16(34, BIT_DEPTH, true);

    // data sub-chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    // Write PCM data
    for (let i = 0; i < pcmData.length; i++) {
      view.setInt16(44 + i * bytesPerSample, pcmData[i], true);
    }

    return buffer;
  }

  private writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private async cleanupSound(stringIndex: number, expectedMidi: number): Promise<void> {
    const pooled = this.soundPool[stringIndex];
    if (pooled && pooled.midiNote === expectedMidi) {
      pooled.isPlaying = false;
      if (pooled.sound) {
        try {
          await pooled.sound.unloadAsync();
        } catch (e) {
          // Ignore
        }
      }
      this.soundPool[stringIndex] = null;
    }
  }

  private async stopString(stringIndex: number): Promise<void> {
    const pooled = this.soundPool[stringIndex];
    if (!pooled) return;

    pooled.isPlaying = false;

    if (pooled.sound) {
      try {
        await pooled.sound.stopAsync();
        await pooled.sound.unloadAsync();
      } catch (e) {
        // Ignore stop/unload errors
      }
    }

    this.soundPool[stringIndex] = null;
  }

  async stopAll(): Promise<void> {
    const stopPromises: Promise<void>[] = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      stopPromises.push(this.stopString(i));
    }
    await Promise.all(stopPromises);
  }

  isStringPlaying(guitarString: GuitarString): boolean {
    const index = STRING_TO_INDEX[guitarString];
    const pooled = this.soundPool[index];
    return pooled?.isPlaying ?? false;
  }
}

export const SamplePlayer = new SamplePlayerImpl();
