"""
MIDI export functionality for the riff engine.
Converts tab events to MIDI format using midiutil (optional dependency).
"""

import os

# String to MIDI note mapping (standard tuning)
# E2=40, A2=45, D3=50, G3=55, B3=59, E4=64
STRING_MIDI_BASE = {
    "E": 40,  # Low E string
    "A": 45,
    "D": 50,
    "G": 55,
    "B": 59,
    "e": 64,  # High e string
}

# Check if midiutil is available
try:
    from midiutil import MIDIFile
    MIDI_AVAILABLE = True
except ImportError:
    MIDI_AVAILABLE = False


def is_midi_available():
    """Check if MIDI export is available (midiutil installed)."""
    return MIDI_AVAILABLE


def fret_to_midi_note(string, fret):
    """
    Convert a guitar string and fret to a MIDI note number.

    Args:
        string: String name ("E", "A", "D", "G", "B", "e")
        fret: Fret number (0 = open string)

    Returns:
        MIDI note number (0-127)
    """
    base = STRING_MIDI_BASE.get(string, 40)
    return base + fret


def events_to_midi(events, bpm=120, steps_per_beat=4):
    """
    Convert tab events to a MIDI file object.

    Args:
        events: List of note events with string, fret, step, duration
        bpm: Tempo in beats per minute
        steps_per_beat: Number of steps per beat (4 = 16th notes)

    Returns:
        MIDIFile object or None if midiutil not available
    """
    if not MIDI_AVAILABLE:
        return None

    # Create MIDI file with 1 track
    midi = MIDIFile(1)

    # Track 0 settings
    track = 0
    channel = 0  # Acoustic guitar typically on channel 0
    time = 0  # Start at the beginning
    volume = 100  # 0-127

    # Set tempo
    midi.addTempo(track, time, bpm)

    # Set instrument to Acoustic Guitar (nylon) - program 24
    # Could also use 25 for steel string
    midi.addProgramChange(track, channel, time, 24)

    # Add track name
    midi.addTrackName(track, time, "Guitar Tab")

    # Convert each event to MIDI note
    for event in events:
        string = event["string"]
        fret = event["fret"]
        step = event["step"]
        duration = event.get("duration", 1)

        # Convert step to beat time
        # step 0 = beat 0, step 4 = beat 1, etc. (with steps_per_beat=4)
        beat_time = step / steps_per_beat

        # Convert duration from steps to beats
        beat_duration = duration / steps_per_beat

        # Get MIDI note number
        pitch = fret_to_midi_note(string, fret)

        # Add note to MIDI file
        midi.addNote(track, channel, pitch, beat_time, beat_duration, volume)

    return midi


def save_midi(midi, filepath):
    """
    Save a MIDIFile object to disk.

    Args:
        midi: MIDIFile object
        filepath: Path to save the MIDI file

    Returns:
        True if successful, False otherwise
    """
    if midi is None:
        return False

    try:
        # Ensure directory exists
        os.makedirs(os.path.dirname(filepath) or ".", exist_ok=True)

        with open(filepath, "wb") as f:
            midi.writeFile(f)
        return True
    except Exception as e:
        print(f"Error saving MIDI file: {e}")
        return False


def events_to_midi_file(events, filepath, bpm=120, steps_per_beat=4):
    """
    Convert tab events directly to a MIDI file on disk.

    Args:
        events: List of note events with string, fret, step, duration
        filepath: Path to save the MIDI file
        bpm: Tempo in beats per minute
        steps_per_beat: Number of steps per beat (4 = 16th notes)

    Returns:
        True if successful, False if midiutil not available or error
    """
    midi = events_to_midi(events, bpm, steps_per_beat)
    if midi is None:
        return False
    return save_midi(midi, filepath)


def get_midi_install_instructions():
    """Return instructions for installing midiutil."""
    return (
        "MIDI export requires the 'midiutil' library.\n"
        "Install it with: pip install midiutil"
    )
