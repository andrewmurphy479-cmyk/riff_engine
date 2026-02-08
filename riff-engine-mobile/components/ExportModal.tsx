import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import { AudioExporter, ExportProgress, ExportResult } from '../audio/AudioExporter';
import { TabEvent } from '../engine/types';
import { colors, spacing, borderRadius, typography } from '../theme/colors';

interface ExportModalProps {
  visible: boolean;
  onClose: () => void;
  events: TabEvent[];
  tempo: number;
}

export function ExportModal({ visible, onClose, events, tempo }: ExportModalProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [exportedFilePath, setExportedFilePath] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setProgress({ phase: 'rendering', progress: 0, message: 'Starting export...' });
    setExportedFilePath(null);

    const result = await AudioExporter.exportToWav(events, tempo, setProgress);

    setIsExporting(false);

    if (result.success && result.filePath) {
      setExportedFilePath(result.filePath);
    } else {
      Alert.alert('Export Failed', result.error || 'Unknown error occurred');
    }
  }, [events, tempo]);

  const handleShare = useCallback(async () => {
    if (!exportedFilePath) return;

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert('Sharing Unavailable', 'Sharing is not available on this device');
      return;
    }

    try {
      await Sharing.shareAsync(exportedFilePath, {
        mimeType: 'audio/wav',
        dialogTitle: 'Share your riff',
      });
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Share Failed', 'Could not share the file');
    }
  }, [exportedFilePath]);

  const handleClose = useCallback(() => {
    if (!isExporting) {
      setProgress(null);
      setExportedFilePath(null);
      onClose();
    }
  }, [isExporting, onClose]);

  const getProgressPercent = () => {
    if (!progress) return 0;
    return Math.round(progress.progress * 100);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Export Riff</Text>

          {!isExporting && !exportedFilePath && (
            <>
              <Text style={styles.description}>
                Export your riff as a WAV audio file that you can share or use in other apps.
              </Text>

              <View style={styles.formatInfo}>
                <Text style={styles.formatLabel}>Format</Text>
                <Text style={styles.formatValue}>WAV (44.1kHz, 16-bit)</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Notes</Text>
                <Text style={styles.infoValue}>{events.length}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Tempo</Text>
                <Text style={styles.infoValue}>{tempo} BPM</Text>
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleClose}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.exportButton}
                  onPress={handleExport}
                  activeOpacity={0.7}
                >
                  <Text style={styles.exportButtonText}>Export WAV</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {isExporting && progress && (
            <View style={styles.progressContainer}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.progressMessage}>{progress.message}</Text>
              <View style={styles.progressBarContainer}>
                <View
                  style={[styles.progressBar, { width: `${getProgressPercent()}%` }]}
                />
              </View>
              <Text style={styles.progressPercent}>{getProgressPercent()}%</Text>
            </View>
          )}

          {!isExporting && exportedFilePath && (
            <View style={styles.successContainer}>
              <Text style={styles.successIcon}>&#x2713;</Text>
              <Text style={styles.successText}>Export Complete!</Text>
              <Text style={styles.filePathText}>
                Your riff has been exported and is ready to share.
              </Text>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleClose}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelButtonText}>Done</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={handleShare}
                  activeOpacity={0.7}
                >
                  <Text style={styles.shareButtonText}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modal: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  title: {
    fontSize: typography.h3.fontSize,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  description: {
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
    lineHeight: 22,
  },
  formatInfo: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  formatLabel: {
    fontSize: typography.small.fontSize,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  formatValue: {
    fontSize: typography.body.fontSize,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  infoLabel: {
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: typography.body.fontSize,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  exportButton: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  exportButtonText: {
    fontSize: typography.body.fontSize,
    color: colors.white,
    fontWeight: '600',
  },
  progressContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  progressMessage: {
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 4,
  },
  progressPercent: {
    fontSize: typography.small.fontSize,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  successIcon: {
    fontSize: 48,
    color: colors.success,
    marginBottom: spacing.md,
  },
  successText: {
    fontSize: typography.h3.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  filePathText: {
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  shareButton: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  shareButtonText: {
    fontSize: typography.body.fontSize,
    color: colors.white,
    fontWeight: '600',
  },
});
