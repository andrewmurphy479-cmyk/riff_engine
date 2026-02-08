import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRiffStore } from '../store/useRiffStore';
import { colors, spacing, typography } from '../theme/colors';
import { RiffLayer } from '../engine/types';
import { Slider } from './ui/Slider';

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
    generationMode,
    layers,
    progression,
    startLayeredGeneration,
    regenerateCurrentLayer,
    approveCurrentLayer,
    goBackToLayer,
    setLayerComplexity,
    toggleLayerMute,
    toggleLayerLock,
  } = useRiffStore();

  if (generationMode !== 'layerBuilder') return null;

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
          <Text style={styles.startButtonText}>Begin Riff</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // All complete
  if (allComplete) {
    const anyLocked = layers.layerLocked.melody || layers.layerLocked.bass || layers.layerLocked.fills;

    return (
      <View style={styles.container}>
        <View style={styles.completeHeader}>
          <Text style={styles.completeIcon}>✅</Text>
          <Text style={styles.completeText}>Riff Complete!</Text>
        </View>

        {/* Layer mute toggles */}
        <Text style={styles.sectionLabel}>Layer Mixer</Text>
        <View style={styles.layerMixer}>
          {LAYER_ORDER.map((layer) => {
            const isMuted = layers.layerMuted[layer];
            return (
              <TouchableOpacity
                key={layer}
                style={[
                  styles.mixerButton,
                  isMuted && styles.mixerButtonMuted,
                ]}
                onPress={() => toggleLayerMute(layer)}
              >
                <Text style={styles.mixerIcon}>{LAYER_INFO[layer].icon}</Text>
                <Text
                  style={[
                    styles.mixerButtonLabel,
                    isMuted && styles.mixerLabelMuted,
                  ]}
                >
                  {LAYER_INFO[layer].label}
                </Text>
                <Text style={styles.mixerStatus}>
                  {isMuted ? '🔇' : '🔊'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Layer lock toggles */}
        <Text style={styles.sectionLabel}>Lock & Vary</Text>
        <View style={styles.layerMixer}>
          {LAYER_ORDER.map((layer) => {
            const isLocked = layers.layerLocked[layer];
            return (
              <TouchableOpacity
                key={layer}
                style={[
                  styles.lockButton,
                  isLocked && styles.lockButtonActive,
                ]}
                onPress={() => toggleLayerLock(layer)}
              >
                <Text style={styles.lockIcon}>{isLocked ? '🔒' : '🔓'}</Text>
                <Text
                  style={[
                    styles.lockLabel,
                    isLocked && styles.lockLabelActive,
                  ]}
                >
                  {LAYER_INFO[layer].label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.mixerHint}>
          {anyLocked
            ? 'Locked layers will be preserved when building new riff'
            : 'Lock layers you love, then regenerate the rest'}
        </Text>

        <TouchableOpacity
          style={styles.restartButton}
          onPress={startLayeredGeneration}
        >
          <Text style={styles.restartButtonText}>
            {anyLocked ? 'Vary Unlocked Layers' : 'Build New Riff'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Building in progress
  return (
    <View style={styles.container}>
      {/* Progress indicator - tap approved layers to go back */}
      <View style={styles.progress}>
        {LAYER_ORDER.map((layer, index) => {
          const isComplete = layers.isLayerApproved[layer];
          const isCurrent = layer === currentLayer;
          const canGoBack = isComplete && !isCurrent;

          return (
            <TouchableOpacity
              key={layer}
              style={styles.progressStep}
              onPress={() => canGoBack && goBackToLayer(layer)}
              disabled={!canGoBack}
              activeOpacity={canGoBack ? 0.7 : 1}
            >
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
                  canGoBack && styles.progressLabelClickable,
                ]}
              >
                {LAYER_INFO[layer].label}
              </Text>
              {canGoBack && <Text style={styles.editHint}>tap to edit</Text>}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Current layer info */}
      <View style={styles.currentLayer}>
        <Text style={styles.currentIcon}>{currentInfo.icon}</Text>
        <Text style={styles.currentTitle}>{currentInfo.label}</Text>
        <Text style={styles.currentDescription}>{currentInfo.description}</Text>
      </View>

      {/* Layer complexity slider */}
      <View style={styles.complexitySlider}>
        <Slider
          label={`${currentInfo.label} Complexity`}
          value={layers.layerComplexity[currentLayer]}
          onValueChange={(value) => setLayerComplexity(currentLayer, value)}
          minimumValue={1}
          maximumValue={5}
          step={1}
        />
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.regenerateButton}
          onPress={regenerateCurrentLayer}
        >
          <Text style={styles.regenerateText}>🔄 Try Another</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.approveButton}
          onPress={approveCurrentLayer}
        >
          <Text style={styles.approveText}>✓ Commit Layer</Text>
        </TouchableOpacity>
      </View>

      {/* Hint */}
      <Text style={styles.hint}>
        {currentLayer === 'melody'
          ? 'Listen to the melody, then approve or regenerate'
          : `Listen to the ${currentInfo.label.toLowerCase()} with approved layers, then approve or regenerate`}
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
  progressLabelClickable: {
    color: colors.success,
    textDecorationLine: 'underline',
  },
  editHint: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 2,
  },
  currentLayer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
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
  complexitySlider: {
    marginVertical: spacing.md,
    paddingHorizontal: spacing.sm,
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
  sectionLabel: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  layerMixer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  mixerButton: {
    flex: 1,
    backgroundColor: colors.success + '20',
    borderRadius: 8,
    padding: spacing.sm,
    alignItems: 'center',
  },
  mixerButtonMuted: {
    backgroundColor: colors.border,
    opacity: 0.6,
  },
  mixerIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  mixerButtonLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  mixerLabelMuted: {
    color: colors.textMuted,
  },
  mixerStatus: {
    fontSize: 12,
    marginTop: 2,
  },
  lockButton: {
    flex: 1,
    backgroundColor: colors.border,
    borderRadius: 8,
    padding: spacing.sm,
    alignItems: 'center',
  },
  lockButtonActive: {
    backgroundColor: colors.accent + '20',
  },
  lockIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  lockLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  lockLabelActive: {
    color: colors.accent,
  },
  mixerHint: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
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
