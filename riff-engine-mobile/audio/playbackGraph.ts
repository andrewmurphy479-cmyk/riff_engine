// Web Audio playback graph (react-native-audio-api).
//
// One shared AudioContext feeding a master bus:
//
//   note gain ──┬──> master ──> soft limiter ──> destination
//               └──> reverb send ──> convolver (generated IR) ──> master
//
// Reverb and limiting live on the bus, NOT inside each clip. The expo-av
// architecture baked reverb into every cached WAV, so overlapping ring tails
// stacked six wet copies — the failure mode that sank the ring-length fix
// (commit 34661aa, reverted in c641f61). Here tails share one room and one
// ceiling, and gain automation is sample-accurate instead of bridge-latency
// volume stepping.

import { AppState, AppStateStatus } from 'react-native';
import type { AudioNode } from 'react-native-audio-api';
import {
  AudioContext,
  AudioManager,
  ConvolverNode,
  GainNode,
  WaveShaperNode,
} from 'react-native-audio-api';
import { SAMPLE_RATE } from './KarplusStrong';
import {
  makeImpulseResponse,
  makeSoftKneeCurve,
  REVERB_SEND_LEVEL,
} from './masterChain';

// The room and the limiter live in masterChain so the offline renderer
// (AudioExporter, tools/batch.ts) convolves against the same IR and shapes
// with the same curve. Audit A9: these used to be two different renderers and
// a shared riff did not sound like the app that made it.

/** Load the shared IR into a context-owned AudioBuffer. */
function impulseResponseBuffer(ctx: AudioContext) {
  const ir = makeImpulseResponse(SAMPLE_RATE);
  const buffer = ctx.createBuffer(2, ir.left.length, SAMPLE_RATE);
  buffer.copyToChannel(ir.left, 0);
  buffer.copyToChannel(ir.right, 1);
  return buffer;
}

// Audit A3: the context is *requested* at SAMPLE_RATE, but the platform is
// free to ignore that and hand back the hardware rate (most iOS hardware runs
// 48k). If it does, every AudioBuffer built at SAMPLE_RATE gets resampled on
// playback — the exact cost the fixed-rate context was meant to avoid — and it
// also decides what rate the F2 sample library should be authored at. One
// startup line so the answer shows up in the Metro console on the next launch.
function logSampleRate(ctx: AudioContext): void {
  let preferred: number | string;
  try {
    preferred = AudioManager.getDevicePreferredSampleRate();
  } catch (error) {
    preferred = `unavailable (${String(error)})`;
  }
  const honored = ctx.sampleRate === SAMPLE_RATE;
  console.log(
    `[audio] sampleRate: requested ${SAMPLE_RATE}, context reports ${ctx.sampleRate}, ` +
      `device prefers ${preferred} — ${honored ? 'HONORED (no resampling)' : 'IGNORED: buffers are being resampled per playback'}`,
  );
}

class PlaybackGraphImpl {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private limiter: WaveShaperNode | null = null;
  private convolver: ConvolverNode | null = null;
  private reverbSend: GainNode | null = null;
  /** Set by AudioEngine — tears down playback when the session goes away. */
  private onSessionLost: (() => void) | null = null;

  get isInitialized(): boolean {
    return this.ctx !== null;
  }

  /**
   * Register the "playback can no longer continue" callback (AudioEngine.stop).
   * Kept as a callback rather than importing AudioEngine here, which would be
   * a cycle — AudioEngine already imports this module.
   */
  setSessionLostHandler(cb: () => void): void {
    this.onSessionLost = cb;
  }

  get context(): AudioContext {
    if (!this.ctx) {
      throw new Error('PlaybackGraph.initialize() has not completed');
    }
    return this.ctx;
  }

  async initialize(): Promise<void> {
    if (this.ctx) return;

    await this.claimSession();

    // Run the context at the synth's rate so buffer playback never depends on
    // the implementation resampling AudioBuffers to a different context rate.
    const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });

    const limiter = ctx.createWaveShaper();
    limiter.curve = makeSoftKneeCurve();
    limiter.connect(ctx.destination);

    const master = ctx.createGain();
    master.gain.value = 1.0;
    master.connect(limiter);

    const convolver = ctx.createConvolver();
    // masterChain pre-normalizes the IR with the Web Audio normalization
    // formula, so the node must not apply its own on top — otherwise the
    // offline path, which cannot call into the node, would sit at a different
    // wet level than live.
    convolver.normalize = false;
    convolver.buffer = impulseResponseBuffer(ctx);
    convolver.connect(master);

    const reverbSend = ctx.createGain();
    reverbSend.gain.value = REVERB_SEND_LEVEL;
    reverbSend.connect(convolver);

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    logSampleRate(ctx);
    this.observeSession(ctx);

    this.ctx = ctx;
    this.master = master;
    this.limiter = limiter;
    this.convolver = convolver;
    this.reverbSend = reverbSend;
  }

  private async claimSession(): Promise<void> {
    // 'playback' plays through the ringer switch, like expo-av's
    // playsInSilentModeIOS; allow haptics so lib/haptics keeps working
    // during playback.
    AudioManager.setAudioSessionOptions({
      iosCategory: 'playback',
      iosMode: 'default',
      iosAllowHaptics: true,
    });
    await AudioManager.setAudioSessionActivity(true);
  }

  /**
   * Take the audio session back after an in-app full-screen ad. Its video
   * player can change the session category or deactivate it without any
   * interruption or AppState event reaching observeSession, which would leave
   * the next riff silent or muted by the ringer switch.
   */
  async reclaimSession(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;
    try {
      await this.claimSession();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
    } catch (error) {
      console.error('[audio] failed to reclaim audio session:', error);
    }
  }

  /**
   * Audit A1/A2. Nothing used to watch the audio session, so a phone call,
   * Siri, an alarm, another app taking audio, or simply backgrounding the app
   * left the context suspended with nothing to resume it — playback "randomly
   * died" and the play button did nothing until a reload.
   *
   * Policy: any event that takes the session away STOPS playback (so the UI's
   * play/pause and playhead match reality) and any return to the foreground
   * revives the context so the next tap works. Playback is deliberately NOT
   * auto-restarted — resuming a riff mid-bar after a phone call is worse than
   * letting the user tap play.
   */
  private observeSession(ctx: AudioContext): void {
    const revive = async (): Promise<void> => {
      try {
        await AudioManager.setAudioSessionActivity(true);
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
      } catch (error) {
        console.error('[audio] failed to revive audio session:', error);
      }
    };

    AudioManager.observeAudioInterruptions(true);

    AudioManager.addSystemEventListener('interruption', ({ type }) => {
      if (type === 'began') {
        this.onSessionLost?.();
      } else {
        // `shouldResume` only says the system would ALLOW resuming; we still
        // just revive the context and leave the transport to the user.
        void revive();
      }
    });

    // Headphones yanked / Bluetooth dropped: iOS convention is to stop, not to
    // blast the riff out of the phone speaker.
    AudioManager.addSystemEventListener('routeChange', ({ reason }) => {
      if (reason === 'OldDeviceUnavailable') {
        this.onSessionLost?.();
      }
    });

    // iOS suspends us on background (iosBackgroundMode is false in app.json).
    AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        void revive();
      } else if (next === 'background') {
        this.onSessionLost?.();
      }
    });
  }

  /** Route a note's output into the bus: dry + shared reverb send. */
  connectNote(node: AudioNode): void {
    node.connect(this.master!);
    node.connect(this.reverbSend!);
  }

  /** Route a metronome tick dry only — clicks don't belong in the room. */
  connectDry(node: AudioNode): void {
    node.connect(this.master!);
  }
}

export const PlaybackGraph = new PlaybackGraphImpl();
