import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRiffStore } from '../store/useRiffStore';
import { colors, spacing, typography } from '../theme/colors';
import { RiffLayer } from '../engine/types';

const LAYER_INFO: Record<RiffLayer, { label: string; description: string; icon: string }> = {
  melody: {
    label: 'Melody',
    description: 'The main melodic line - the "tune" of your riff',
    icon: '🎵',
  },
  bass: {
    label: 'Bass',
    description: 'Alternating bass pattern - the foundation',
    icon: '🎸',
  },
  fills: {
    label: 'Fills',
    description: 'Passing tones and ornaments',
    icon: '✨',
  },
};

const LAYER_ORDER: RiffLayer[] = ['melody', 'bass', 'fills'];

export function LayerBuilder() {
  const {
    isLayeredMode,
    layers,
    progression,
    startLayeredGeneration,
    regenerateCurrentLayer,
    approveCurrentLayer,
  } = useRiffStore();

  if (!isLayeredMode) return null;

  const currentLayer = layers.currentLayer;
  const currentInfo = LAYER_INFO[currentLayer];
  const allComplete = layers.isLayerApproved.melody &&
                      layers.isLayerApproved.bass &&
                      layers.isLayerApproved.fills;

  // Not started yet
  if (!progression) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Build Your Riff</Text>
        <Text style={styles.subtitle}>
          Create layer by layer - approve each part before moving on
        </Text>

        <View style={styles.layerPreview}>
          {LAYER_ORDER.map((layer, index) => (
            <View key={layer} style={styles.previewItem}>
              <Text style={styles.previewIcon}>{LAYER_INFO[layer].icon}</Text>
              <Text style={styles.previewLabel}>
                {index + 1}. {LAYER_INFO[layer].label}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.startButton} onPress={startLayeredGeneration}>
          <Text style={styles.startButtonText}>Start Building</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // All complete
  if (allComplete) {
    return (
      <View style={styles.container}>
        <View style={styles.completeHeader}>
          <Text style={styles.completeIcon}>✅</Text>
          <Text style={styles.completeText}>Riff Complete!</Text>
        </View>

        <View style={styles.layerStatus}>
          {LAYER_ORDER.map((layer) => (
            <View key={layer} style={styles.statusItem}>
              <Text style={styles.statusCheck}>✓</Text>
              <Text style={styles.statusLabel}>{LAYER_INFO[layer].label}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.restartButton}
          onPress={startLayeredGeneration}
        >
          <Text style={styles.restartButtonText}>Build New Riff</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Building in progress
  return (
    <View style={styles.container}>
      {/* Progress indicator */}
      <View style={styles.progress}>
        {LAYER_ORDER.map((layer, index) => {
          const isComplete = layers.isLayerApproved[layer];
          const isCurrent = layer === currentLayer;

          return (
            <View key={layer} style={styles.progressStep}>
              <View
                style={[
                  styles.progressDot,
                  isComplete && styles.progressDotComplete,
                  isCurrent && styles.progressDotCurrent,
                ]}
              >
                {isComplete ? (
                  <Text style={styles.progressCheck}>✓</Text>
                ) : (
                  <Text style={styles.progressNumber}>{index + 1}</Text>
                )}
              </View>
              <Text
                style={[
                  styles.progressLabel,
                  isCurrent && styles.progressLabelCurrent,
                ]}
              >
                {LAYER_INFO[layer].label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Current layer info */}
      <View style={styles.currentLayer}>
        <Text style={styles.currentIcon}>{currentInfo.icon}</Text>
        <Text style={styles.currentTitle}>{currentInfo.label}</Text>
        <Text style={styles.currentDescription}>{currentInfo.description}</Text>
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.regenerateButton}
          onPress={regenerateCurrentLayer}
        >
          <Text style={styles.regenerateText}>🔄 Regenerate</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.approveButton}
          onPress={approveCurrentLayer}
        >
          <Text style={styles.approveText}>✓ Approve & Continue</Text>
        </TouchableOpacity>
      </View>

      {/* Hint */}
      <Text style={styles.hint}>
        Listen to the {currentInfo.label.toLowerCase()}, then approve or regenerate
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.h2.fontSize,
    fontWeight: typography.h2.fontWeight as any,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  layerPreview: {
    marginBottom: spacing.lg,
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  previewIcon: {
    fontSize: 20,
    marginRight: spacing.md,
  },
  previewLabel: {
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
  },
  startButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  startButtonText: {
    color: colors.textPrimary,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  progress: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  progressStep: {
    alignItems: 'center',
    flex: 1,
  },
  progressDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  progressDotComplete: {
    backgroundColor: colors.success,
  },
  progressDotCurrent: {
    backgroundColor: colors.accent,
  },
  progressCheck: {
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  progressNumber: {
    color: colors.textMuted,
    fontWeight: 'bold',
  },
  progressLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  progressLabelCurrent: {
    color: colors.accent,
    fontWeight: '600',
  },
  currentLayer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  currentIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  currentTitle: {
    fontSize: typography.h3.fontSize,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  currentDescription: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  regenerateButton: {
    flex: 1,
    backgroundColor: colors.border,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  regenerateText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  approveButton: {
    flex: 1,
    backgroundColor: colors.success,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveText: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  hint: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  completeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  completeIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  completeText: {
    fontSize: typography.h3.fontSize,
    fontWeight: '600',
    color: colors.success,
  },
  layerStatus: {
    marginBottom: spacing.lg,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  statusCheck: {
    color: colors.success,
    marginRight: spacing.sm,
    fontWeight: 'bold',
  },
  statusLabel: {
    color: colors.textSecondary,
  },
  restartButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  restartButtonText: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
