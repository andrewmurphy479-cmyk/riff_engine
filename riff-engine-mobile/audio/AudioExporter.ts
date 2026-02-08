import * as FileSystem from 'expo-file-system/legacy';
import { TabEvent } from '../engine/types';
import { fretToMidiNote } from './noteMapping';
import {
  synthesizeTone,
  createStereoWavBuffer,
  arrayBufferToBase64,
  applyReverb,
  applyDynamics,
  SAMPLE_RATE,
} from './KarplusStrong';

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

      const stepsPerBeat = 4;
      const secondsPerStep = 60 / bpm / stepsPerBeat;

      const maxStep = Math.max(...events.map(e => e.step + e.duration));
      const totalDurationSeconds = maxStep * secondsPerStep + 0.5;
      const totalSamples = Math.ceil(totalDurationSeconds * SAMPLE_RATE);

      onProgress?.({ phase: 'rendering', progress: 0.1, message: 'Rendering audio...' });

      // Stereo mix buffers
      const mixL = new Float32Array(totalSamples);
      const mixR = new Float32Array(totalSamples);

      // Pre-compute grouped jitter: one jitter value per unique step
      const stepJitter = new Map<number, number>();
      for (const event of events) {
        if (!stepJitter.has(event.step)) {
          const stepInBar = event.step % 16;
          const isDownbeat = stepInBar % 4 === 0;
          const jitterRange = isDownbeat ? 3 : 8;
          stepJitter.set(event.step, (Math.random() - 0.5) * 2 * jitterRange);
        }
      }

      // Render each note into the stereo mix buffer
      for (let i = 0; i < events.length; i++) {
        const event = events[i];

        const jitterMs = stepJitter.get(event.step) ?? 0;
        const jitterSamples = Math.round((jitterMs / 1000) * SAMPLE_RATE);

        const startSample = Math.max(0, Math.floor(event.step * secondsPerStep * SAMPLE_RATE) + jitterSamples);
        const durationMs = event.duration * secondsPerStep * 1000;
        const velocity = event.velocity ?? 0.7;
        const midiNote = fretToMidiNote(event.string, event.fret);

        // Synthesize with technique and string info (returns stereo with panning baked in)
        const { left, right } = synthesizeTone({
          midiNote,
          durationMs,
          velocity,
          technique: event.technique ?? undefined,
          guitarString: event.string,
        });

        // Mix into stereo buffers (additive)
        for (let j = 0; j < left.length; j++) {
          const idx = startSample + j;
          if (idx >= totalSamples) break;
          mixL[idx] += left[j];
          mixR[idx] += right[j];
        }

        const progress = 0.1 + (i / events.length) * 0.4;
        onProgress?.({ phase: 'rendering', progress, message: `Rendering note ${i + 1}/${events.length}...` });
      }

      onProgress?.({ phase: 'rendering', progress: 0.5, message: 'Applying reverb...' });

      // Apply Schroeder reverb (15% wet mix)
      applyReverb(mixL, mixR, 0.15);

      onProgress?.({ phase: 'rendering', progress: 0.55, message: 'Applying dynamics...' });

      // Normalize before dynamics
      let maxAmplitude = 0;
      for (let i = 0; i < totalSamples; i++) {
        const absL = Math.abs(mixL[i]);
        const absR = Math.abs(mixR[i]);
        if (absL > maxAmplitude) maxAmplitude = absL;
        if (absR > maxAmplitude) maxAmplitude = absR;
      }
      if (maxAmplitude > 0) {
        const normalizeRatio = 0.9 / maxAmplitude;
        for (let i = 0; i < totalSamples; i++) {
          mixL[i] *= normalizeRatio;
          mixR[i] *= normalizeRatio;
        }
      }

      // Apply compressor/limiter
      applyDynamics(mixL, mixR);

      onProgress?.({ phase: 'encoding', progress: 0.6, message: 'Encoding stereo WAV...' });

      // Create stereo WAV file
      const wavBuffer = createStereoWavBuffer(mixL, mixR);

      onProgress?.({ phase: 'saving', progress: 0.8, message: 'Saving file...' });

      const fileName = `riff_${Date.now()}.wav`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;

      const base64Data = arrayBufferToBase64(wavBuffer);
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
