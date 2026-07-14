import * as FileSystem from 'expo-file-system/legacy';
import { TabEvent } from '../engine/types';
import { renderEventsToStereo } from './offlineRender';
import { createStereoWavBuffer, arrayBufferToBase64 } from './KarplusStrong';

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

      const { left, right } = renderEventsToStereo(events, bpm, {
        onProgress: (fraction) => {
          onProgress?.({
            phase: 'rendering',
            progress: 0.1 + fraction * 0.5,
            message: `Rendering audio... ${Math.round(fraction * 100)}%`,
          });
        },
      });

      onProgress?.({ phase: 'encoding', progress: 0.6, message: 'Encoding stereo WAV...' });

      const wavBuffer = createStereoWavBuffer(left, right);

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
