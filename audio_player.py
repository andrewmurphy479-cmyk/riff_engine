"""
Audio playback for the riff engine.
Uses system MIDI player or pygame if available.
"""

import os
import sys
import time
import tempfile

# Try pygame first (best experience if available)
try:
    import pygame
    import pygame.midi
    PYGAME_AVAILABLE = True
except ImportError:
    PYGAME_AVAILABLE = False

# Check for midiutil (needed for file-based playback)
try:
    from midiutil import MIDIFile
    MIDIUTIL_AVAILABLE = True
except ImportError:
    MIDIUTIL_AVAILABLE = False

# String to MIDI note mapping (standard tuning)
STRING_MIDI_BASE = {
    "E": 40,  # Low E string
    "A": 45,
    "D": 50,
    "G": 55,
    "B": 59,
    "e": 64,  # High e string
}


def is_audio_available():
    """Check if audio playback is available."""
    # On Windows, we can use system MIDI player if midiutil is available
    if sys.platform == "win32" and MIDIUTIL_AVAILABLE:
        return True
    # Otherwise need pygame
    return PYGAME_AVAILABLE


def get_install_instructions():
    """Return instructions for enabling audio."""
    if sys.platform == "win32":
        return (
            "Audio playback requires 'midiutil' library.\n"
            "Install it with: py -m pip install midiutil"
        )
    return (
        "Audio playback requires 'pygame' library.\n"
        "Install it with: py -m pip install pygame"
    )


def fret_to_midi_note(string, fret):
    """Convert guitar string and fret to MIDI note number."""
    base = STRING_MIDI_BASE.get(string, 40)
    return base + fret


def _create_temp_midi(events, bpm, steps_per_beat=4):
    """Create a temporary MIDI file from events."""
    if not MIDIUTIL_AVAILABLE:
        return None

    midi = MIDIFile(1)
    track = 0
    channel = 0
    volume = 100

    midi.addTempo(track, 0, bpm)
    midi.addProgramChange(track, channel, 0, 24)  # Acoustic guitar

    for event in events:
        string = event["string"]
        fret = event["fret"]
        step = event["step"]
        duration = event.get("duration", 1)

        beat_time = step / steps_per_beat
        beat_duration = duration / steps_per_beat
        pitch = fret_to_midi_note(string, fret)

        midi.addNote(track, channel, pitch, beat_time, beat_duration, volume)

    # Write to temp file
    temp_fd, temp_path = tempfile.mkstemp(suffix=".mid")
    try:
        with os.fdopen(temp_fd, "wb") as f:
            midi.writeFile(f)
        return temp_path
    except:
        os.close(temp_fd)
        return None


def _calculate_duration(events, bpm, steps_per_beat=4):
    """Calculate total duration of the riff in seconds."""
    if not events:
        return 0
    max_step = max(e["step"] + e.get("duration", 1) for e in events)
    beats = max_step / steps_per_beat
    seconds = beats / (bpm / 60.0)
    return seconds


def play_events(events, bpm, steps_per_beat=4, blocking=True):
    """
    Play a list of tab events.

    Args:
        events: List of note events with string, fret, step, duration
        bpm: Tempo in beats per minute
        steps_per_beat: Number of steps per beat (4 = 16th notes)
        blocking: If True, wait for playback to finish

    Returns:
        True if playback started successfully
    """
    # Try pygame first
    if PYGAME_AVAILABLE:
        return _play_with_pygame(events, bpm, steps_per_beat, blocking)

    # Fall back to system player on Windows
    if sys.platform == "win32" and MIDIUTIL_AVAILABLE:
        return _play_with_system(events, bpm, steps_per_beat, blocking)

    print(get_install_instructions())
    return False


def _play_with_system(events, bpm, steps_per_beat, blocking):
    """Play using Windows system MIDI player."""
    temp_path = _create_temp_midi(events, bpm, steps_per_beat)
    if not temp_path:
        print("Failed to create MIDI file.")
        return False

    try:
        # Use Windows Media Player or default MIDI handler
        os.startfile(temp_path)

        if blocking:
            # Wait for approximate duration plus buffer
            duration = _calculate_duration(events, bpm, steps_per_beat)
            print(f"(Playing for ~{duration:.1f} seconds...)")
            time.sleep(duration + 1.0)

            # Try to clean up temp file
            try:
                os.unlink(temp_path)
            except:
                pass  # File may still be in use

        return True

    except Exception as e:
        print(f"Playback error: {e}")
        return False


def _play_with_pygame(events, bpm, steps_per_beat, blocking):
    """Play using pygame MIDI."""
    try:
        pygame.init()
        pygame.midi.init()

        # Get output device
        default_id = pygame.midi.get_default_output_id()
        if default_id < 0:
            for i in range(pygame.midi.get_count()):
                info = pygame.midi.get_device_info(i)
                if info[3] == 1:
                    default_id = i
                    break

        if default_id < 0:
            print("No MIDI output device found.")
            return False

        midi_out = pygame.midi.Output(default_id)
        midi_out.set_instrument(24)  # Acoustic guitar

        # Build schedule
        beats_per_second = bpm / 60.0
        steps_per_second = beats_per_second * steps_per_beat
        ms_per_step = 1000.0 / steps_per_second

        schedule = []
        for event in events:
            note = fret_to_midi_note(event["string"], event["fret"])
            step = event["step"]
            duration = event.get("duration", 1)

            on_time = step * ms_per_step
            off_time = (step + duration) * ms_per_step

            schedule.append((on_time, note, 100, True))
            schedule.append((off_time, note, 0, False))

        schedule.sort(key=lambda x: (x[0], not x[3]))

        # Play
        start_time = time.time() * 1000

        for scheduled_time, note, velocity, is_note_on in schedule:
            current_time = (time.time() * 1000) - start_time
            wait_time = scheduled_time - current_time

            if wait_time > 0:
                time.sleep(wait_time / 1000.0)

            if is_note_on:
                midi_out.note_on(note, velocity)
            else:
                midi_out.note_off(note, velocity)

        # Cleanup
        time.sleep(0.5)  # Let last notes ring
        for note in range(128):
            midi_out.note_off(note, 0)

        midi_out.close()
        pygame.midi.quit()

        return True

    except Exception as e:
        print(f"Pygame playback error: {e}")
        return False


def stop_playback():
    """Stop any currently playing audio."""
    pass  # Not easily supported with system player


def is_playing():
    """Check if audio is currently playing."""
    return False


def shutdown():
    """Clean up audio resources."""
    pass
