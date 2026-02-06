import * as FileSystem from 'expo-file-system/legacy';
import { TabEvent, GuitarString } from '../engine/types';
import { fretToMidiNote, midiToFrequency } from './noteMapping';

// Audio format constants
const SAMPLE_RATE = 44100;
const BIT_DEPTH = 16;
const NUM_CHANNELS = 1;
const BYTES_PER_SAMPLE = BIT_DEPTH / 8;

export interface ExportProgress {
  phase: 'rendering' | 'encoding' | 'saving';
  progress: number; // 0-1
  message: string;
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

type ProgressCallback = (progress: ExportProgress) => void;

class AudioExporterImpl {
  async exportToWav(
    events: TabEvent[],
    bpm: number,
    onProgress?: ProgressCallback
  ): Promise<ExportResult> {
    try {
      onProgress?.({ phase: 'rendering', progress: 0, message: 'Preparing audio...' });

      if (events.length === 0) {
        return { success: false, error: 'No events to export' };
      }

      // Calculate timing
      const stepsPerBeat = 4;
      const secondsPerStep = 60 / bpm / stepsPerBeat;

      // Find total duration with some padding
      const maxStep = Math.max(...events.map(e => e.step + e.duration));
      const totalDurationSeconds = maxStep * secondsPerStep + 0.5; // Add 0.5s tail
      const totalSamples = Math.ceil(totalDurationSeconds * SAMPLE_RATE);

      onProgress?.({ phase: 'rendering', progress: 0.1, message: 'Rendering audio...' });

      // Create PCM buffer (using Float32 for mixing, then convert to Int16)
      const mixBuffer = new Float32Array(totalSamples);

      // Render each note into the mix buffer
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const startSample = Math.floor(event.step * secondsPerStep * SAMPLE_RATE);
        const durationSamples = Math.floor(event.duration * secondsPerStep * SAMPLE_RATE);

        // Synthesize a plucked string sound
        this.renderNote(
          mixBuffer,
          event.string,
          event.fret,
          startSample,
          durationSamples
        );

        // Update progress
        const progress = 0.1 + (i / events.length) * 0.5;
        onProgress?.({ phase: 'rendering', progress, message: `Rendering note ${i + 1}/${events.length}...` });
      }

      onProgress?.({ phase: 'encoding', progress: 0.6, message: 'Encoding WAV...' });

      // Normalize the mix buffer
      const maxAmplitude = Math.max(...mixBuffer.map(Math.abs));
      if (maxAmplitude > 0) {
        const normalizeRatio = 0.9 / maxAmplitude;
        for (let i = 0; i < mixBuffer.length; i++) {
          mixBuffer[i] *= normalizeRatio;
        }
      }

      // Convert to Int16 PCM
      const pcmData = new Int16Array(totalSamples);
      for (let i = 0; i < totalSamples; i++) {
        const sample = Math.max(-1, Math.min(1, mixBuffer[i]));
        pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      }

      onProgress?.({ phase: 'encoding', progress: 0.7, message: 'Creating WAV file...' });

      // Create WAV file buffer
      const wavBuffer = this.encodeWav(pcmData);

      onProgress?.({ phase: 'saving', progress: 0.8, message: 'Saving file...' });

      // Save to file system
      const fileName = `riff_${Date.now()}.wav`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;

      // Convert to base64 for saving
      const base64Data = this.arrayBufferToBase64(wavBuffer);
      await FileSystem.writeAsStringAsync(filePath, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      onProgress?.({ phase: 'saving', progress: 1, message: 'Export complete!' });

      return { success: true, filePath };
    } catch (error) {
      console.error('Export error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown export error',
      };
    }
  }

  private renderNote(
    buffer: Float32Array,
    guitarString: GuitarString,
    fret: number,
    startSample: number,
    durationSamples: number
  ): void {
    const midiNote = fretToMidiNote(guitarString, fret);
    const frequency = midiToFrequency(midiNote);

    // Karplus-Strong-like plucked string synthesis
    const decayTime = Math.min(durationSamples / SAMPLE_RATE, 2); // Max 2 seconds decay
    const attackTime = 0.002; // 2ms attack
    const attackSamples = Math.floor(attackTime * SAMPLE_RATE);

    // Base amplitude (quieter for higher notes)
    const baseAmplitude = 0.3 * (1 - (midiNote - 40) / 60 * 0.3);

    for (let i = 0; i < durationSamples; i++) {
      const sampleIndex = startSample + i;
      if (sampleIndex >= buffer.length) break;

      const t = i / SAMPLE_RATE;

      // Envelope: quick attack, exponential decay
      let envelope: number;
      if (i < attackSamples) {
        envelope = i / attackSamples;
      } else {
        envelope = Math.exp(-3 * t / decayTime);
      }

      // Plucked string harmonics
      const fundamental = Math.sin(2 * Math.PI * frequency * t);
      const harmonic2 = 0.5 * Math.sin(2 * Math.PI * frequency * 2 * t);
      const harmonic3 = 0.25 * Math.sin(2 * Math.PI * frequency * 3 * t);
      const harmonic4 = 0.125 * Math.sin(2 * Math.PI * frequency * 4 * t);

      // Higher harmonics decay faster
      const h2Decay = Math.exp(-5 * t / decayTime);
      const h3Decay = Math.exp(-8 * t / decayTime);
      const h4Decay = Math.exp(-12 * t / decayTime);

      const sample =
        fundamental +
        harmonic2 * h2Decay +
        harmonic3 * h3Decay +
        harmonic4 * h4Decay;

      // Mix into buffer (additive)
      buffer[sampleIndex] += sample * envelope * baseAmplitude;
    }
  }

  private encodeWav(pcmData: Int16Array): ArrayBuffer {
    const dataLength = pcmData.length * BYTES_PER_SAMPLE;
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    // RIFF header
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    this.writeString(view, 8, 'WAVE');

    // fmt sub-chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Sub-chunk size
    view.setUint16(20, 1, true); // Audio format (PCM)
    view.setUint16(22, NUM_CHANNELS, true);
    view.setUint32(24, SAMPLE_RATE, true);
    view.setUint32(28, SAMPLE_RATE * NUM_CHANNELS * BYTES_PER_SAMPLE, true); // Byte rate
    view.setUint16(32, NUM_CHANNELS * BYTES_PER_SAMPLE, true); // Block align
    view.setUint16(34, BIT_DEPTH, true);

    // data sub-chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    // Write PCM data
    const offset = 44;
    for (let i = 0; i < pcmData.length; i++) {
      view.setInt16(offset + i * BYTES_PER_SAMPLE, pcmData[i], true);
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

  async getExportDirectory(): Promise<string> {
    return FileSystem.documentDirectory || '';
  }

  async deleteExport(filePath: string): Promise<void> {
    try {
      await FileSystem.deleteAsync(filePath);
    } catch (e) {
      console.error('Failed to delete export:', e);
    }
  }
}

export const AudioExporter = new AudioExporterImpl();
