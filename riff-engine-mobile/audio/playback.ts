// This file is deprecated - use useAudioEngine from AudioEngine.ts instead
// Kept for backwards compatibility

import { useCallback, useState } from 'react';
import { TabEvent, PlaybackState } from '../engine/types';
import { useAudioEngine } from './AudioEngine';

export function usePlayback() {
  const [playbackState, setPlaybackState] = useState<PlaybackState>('stopped');

  const audioEngine = useAudioEngine({
    onPlaybackStart: () => setPlaybackState('playing'),
    onPlaybackEnd: () => setPlaybackState('stopped'),
  });

  const play = useCallback((events: TabEvent[], bpm: number) => {
    if (events.length > 0) {
      audioEngine.play(events, bpm);
    }
  }, [audioEngine]);

  const stop = useCallback(() => {
    audioEngine.stop();
  }, [audioEngine]);

  const handlePlaybackStart = useCallback(() => {
    setPlaybackState('playing');
  }, []);

  const handlePlaybackEnd = useCallback(() => {
    setPlaybackState('stopped');
  }, []);

  return {
    playbackState,
    isPlaying: playbackState === 'playing',
    play,
    stop,
    handlePlaybackStart,
    handlePlaybackEnd,
  };
}
