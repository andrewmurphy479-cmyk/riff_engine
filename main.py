import random
import sys
import os
from datetime import datetime

from tab_renderer import render_tab
from midi_export import is_midi_available, events_to_midi_file, get_midi_install_instructions
from audio_player import is_audio_available, play_events, stop_playback, get_install_instructions as get_audio_install_instructions
import library

DEBUG = False  # set True for more prints


# ----------------------------
# UI helpers
# ----------------------------
def choose_from_menu(title, options, default_key):
    print("\n" + title)
    keys = list(options.keys())

    for i, k in enumerate(keys, start=1):
        print(f"{i}) {k}")

    choice = input(f"Choose 1-{len(keys)} (Enter for {default_key}): ").strip()

    if choice == "":
        return default_key

    if choice.isdigit():
        idx = int(choice)
        if 1 <= idx <= len(keys):
            return keys[idx - 1]

    print(f"Invalid choice. Using default: {default_key}")
    return default_key


def choose_int_in_range(prompt, low, high, default):
    raw = input(f"{prompt} ({low}-{high}, Enter for {default}): ").strip()
    if raw == "":
        return default
    if raw.isdigit():
        v = int(raw)
        if low <= v <= high:
            return v
    print(f"Invalid. Using default {default}.")
    return default


# ----------------------------
# High-level "profiles"
# ----------------------------
DIFFICULTIES = {
    "beginner": {
        "fill_multiplier": 0.40,
        "allowed_fill_steps": [14],
        "fill_attempts_per_bar": 1,
        "melody_bias": 0.20,
        "bass_walk_prob": 0.05,
    },
    "intermediate": {
        "fill_multiplier": 0.75,
        "allowed_fill_steps": [10, 14],
        "fill_attempts_per_bar": 2,
        "melody_bias": 0.35,
        "bass_walk_prob": 0.15,
    },
    "advanced": {
        "fill_multiplier": 1.10,
        "allowed_fill_steps": [6, 10, 14],
        "fill_attempts_per_bar": 3,
        "melody_bias": 0.50,
        "bass_walk_prob": 0.25,
    },
}

# Mood affects: tempo, repetition/variation, fill tendency, and "tension feel"
# (We keep chord pool limited to Em/C/G/D for now so everything stays playable)
MOODS = {
    "uplifting":   {"repeat_prob": 0.25, "swap_prob": 0.30, "fill_prob": 0.45, "tempo_range": (95, 135), "tension_bias": 0.15},
    "sad":         {"repeat_prob": 0.45, "swap_prob": 0.20, "fill_prob": 0.25, "tempo_range": (70, 105), "tension_bias": 0.20},
    "mysterious":  {"repeat_prob": 0.35, "swap_prob": 0.35, "fill_prob": 0.40, "tempo_range": (80, 115), "tension_bias": 0.35},

    # Added moods (same chord universe, different behavior)
    "nostalgic":   {"repeat_prob": 0.55, "swap_prob": 0.15, "fill_prob": 0.25, "tempo_range": (72, 102), "tension_bias": 0.20},
    "gritty":      {"repeat_prob": 0.25, "swap_prob": 0.40, "fill_prob": 0.60, "tempo_range": (92, 130), "tension_bias": 0.30},
    "cinematic":   {"repeat_prob": 0.65, "swap_prob": 0.10, "fill_prob": 0.20, "tempo_range": (60, 92),  "tension_bias": 0.25},
    "driving":     {"repeat_prob": 0.20, "swap_prob": 0.45, "fill_prob": 0.55, "tempo_range": (110, 160), "tension_bias": 0.20},
    "dreamy":      {"repeat_prob": 0.60, "swap_prob": 0.12, "fill_prob": 0.22, "tempo_range": (68, 98),  "tension_bias": 0.12},
    "tense":       {"repeat_prob": 0.30, "swap_prob": 0.45, "fill_prob": 0.45, "tempo_range": (78, 120), "tension_bias": 0.55},
    "soulful":     {"repeat_prob": 0.40, "swap_prob": 0.25, "fill_prob": 0.50, "tempo_range": (78, 120), "tension_bias": 0.25},
}

# Section changes density + cadence feel (used as multipliers / small nudges)
SECTIONS = {
    "verse":  {"density": 0.90, "fill_boost": 0.90},
    "chorus": {"density": 1.20, "fill_boost": 1.10},
    "bridge": {"density": 1.00, "fill_boost": 1.25},
    "outro":  {"density": 0.80, "fill_boost": 0.80},
}

# Progression length options
PROGRESSION_LENGTHS = {
    "4-bar": 4,
    "8-bar": 8,
    "12-bar (blues)": 12,
    "16-bar": 16,
}


# ----------------------------
# Chord "note targets" (simple but musical)
# ----------------------------
# Treble "color" notes to pick from for each chord (keep it simple and clean)
CHORD_TREBLE_NOTES = {
    "Em": [{"string": "G", "fret": 0}, {"string": "B", "fret": 0}, {"string": "e", "fret": 0}],
    "C":  [{"string": "G", "fret": 0}, {"string": "B", "fret": 1}, {"string": "e", "fret": 0}],
    "G":  [{"string": "G", "fret": 0}, {"string": "B", "fret": 0}, {"string": "e", "fret": 3}],
    "D":  [{"string": "G", "fret": 2}, {"string": "B", "fret": 3}, {"string": "e", "fret": 2}],
}

CHORD_BASS = {
    "Em": {"string": "E", "fret": 0},
    "C":  {"string": "A", "fret": 3},
    "G":  {"string": "E", "fret": 3},
    "D":  {"string": "D", "fret": 0},
}

# Small bass-walk options to add motion (kept safe & simple)
BASS_WALKS = {
    # (from chord, to chord): list of bass notes (string, fret) to optionally step through
    ("Em", "C"): [{"string": "E", "fret": 0}, {"string": "E", "fret": 2}, {"string": "A", "fret": 3}],
    ("C", "G"):  [{"string": "A", "fret": 3}, {"string": "A", "fret": 2}, {"string": "E", "fret": 3}],
    ("G", "D"):  [{"string": "E", "fret": 3}, {"string": "D", "fret": 0}],
    ("D", "Em"): [{"string": "D", "fret": 0}, {"string": "E", "fret": 0}],
}

STRINGS = ["E", "A", "D", "G", "B", "e"]

# Extended chord definitions for more variety
CHORD_TREBLE_NOTES_EXTENDED = {
    "Am": [{"string": "G", "fret": 2}, {"string": "B", "fret": 1}, {"string": "e", "fret": 0}],
    "A":  [{"string": "G", "fret": 2}, {"string": "B", "fret": 2}, {"string": "e", "fret": 0}],
    "E":  [{"string": "G", "fret": 1}, {"string": "B", "fret": 0}, {"string": "e", "fret": 0}],
    "Dm": [{"string": "G", "fret": 2}, {"string": "B", "fret": 3}, {"string": "e", "fret": 1}],
    "F":  [{"string": "G", "fret": 2}, {"string": "B", "fret": 1}, {"string": "e", "fret": 1}],
    "B7": [{"string": "G", "fret": 2}, {"string": "B", "fret": 0}, {"string": "e", "fret": 2}],
}

CHORD_BASS_EXTENDED = {
    "Am": {"string": "A", "fret": 0},
    "A":  {"string": "A", "fret": 0},
    "E":  {"string": "E", "fret": 0},
    "Dm": {"string": "D", "fret": 0},
    "F":  {"string": "D", "fret": 3},
    "B7": {"string": "A", "fret": 2},
}

# Chord pools by difficulty level
CHORD_POOLS = {
    "beginner": ["Em", "C", "G", "D", "Am", "A", "E"],
    "intermediate": ["Em", "C", "G", "D", "Am", "A", "E", "Dm", "F", "B7"],
    "advanced": ["Em", "C", "G", "D", "Am", "A", "E", "Dm", "F", "B7"],
}

# Additional bass walks for new chord transitions
BASS_WALKS_EXTENDED = {
    ("Am", "C"):  [{"string": "A", "fret": 0}, {"string": "A", "fret": 2}, {"string": "A", "fret": 3}],
    ("Am", "G"):  [{"string": "A", "fret": 0}, {"string": "E", "fret": 2}, {"string": "E", "fret": 3}],
    ("Am", "E"):  [{"string": "A", "fret": 0}, {"string": "A", "fret": 2}, {"string": "E", "fret": 0}],
    ("E", "Am"): [{"string": "E", "fret": 0}, {"string": "E", "fret": 2}, {"string": "A", "fret": 0}],
    ("A", "D"):  [{"string": "A", "fret": 0}, {"string": "A", "fret": 2}, {"string": "D", "fret": 0}],
    ("A", "E"):  [{"string": "A", "fret": 0}, {"string": "E", "fret": 2}, {"string": "E", "fret": 0}],
    ("Dm", "Am"): [{"string": "D", "fret": 0}, {"string": "A", "fret": 2}, {"string": "A", "fret": 0}],
    ("Dm", "C"):  [{"string": "D", "fret": 0}, {"string": "A", "fret": 2}, {"string": "A", "fret": 3}],
    ("F", "C"):   [{"string": "D", "fret": 3}, {"string": "A", "fret": 3}],
    ("F", "G"):   [{"string": "D", "fret": 3}, {"string": "E", "fret": 2}, {"string": "E", "fret": 3}],
    ("B7", "E"):  [{"string": "A", "fret": 2}, {"string": "E", "fret": 2}, {"string": "E", "fret": 0}],
    ("B7", "Em"): [{"string": "A", "fret": 2}, {"string": "E", "fret": 2}, {"string": "E", "fret": 0}],
    ("G", "Em"):  [{"string": "E", "fret": 3}, {"string": "E", "fret": 2}, {"string": "E", "fret": 0}],
    ("C", "Am"):  [{"string": "A", "fret": 3}, {"string": "A", "fret": 2}, {"string": "A", "fret": 0}],
}


def get_chord_treble(chord):
    """Get treble notes for a chord, with fallback to extended dictionary."""
    if chord in CHORD_TREBLE_NOTES:
        return CHORD_TREBLE_NOTES[chord]
    return CHORD_TREBLE_NOTES_EXTENDED.get(chord, CHORD_TREBLE_NOTES["Em"])


def get_chord_bass(chord):
    """Get bass note for a chord, with fallback to extended dictionary."""
    if chord in CHORD_BASS:
        return CHORD_BASS[chord]
    return CHORD_BASS_EXTENDED.get(chord, CHORD_BASS["Em"])


def get_bass_walk(prev_chord, chord):
    """Get bass walk for a chord transition, checking both dictionaries."""
    key = (prev_chord, chord)
    if key in BASS_WALKS:
        return BASS_WALKS[key]
    return BASS_WALKS_EXTENDED.get(key)


# ----------------------------
# Progression generation
# ----------------------------
# Extended root rankings for smoother progressions with new chords
ROOT_RANK = {
    "Em": 0, "E": 0.5, "C": 1, "Am": 1.5, "G": 2, "D": 3, "Dm": 3.5, "A": 4, "F": 5, "B7": 6
}


def progression_score(prog, loop=True):
    """Higher = smoother (very simple heuristic)."""
    score = 0.0
    for i in range(1, len(prog)):
        prev_rank = ROOT_RANK.get(prog[i - 1], 0)
        curr_rank = ROOT_RANK.get(prog[i], 0)
        score += 1.0 - min(1.0, abs(curr_rank - prev_rank) / 3.0)
    if loop and len(prog) > 1:
        first_rank = ROOT_RANK.get(prog[0], 0)
        last_rank = ROOT_RANK.get(prog[-1], 0)
        score += 1.0 - min(1.0, abs(first_rank - last_rank) / 3.0)
    return score


def generate_progression(mood, length=4, difficulty="intermediate", tension=3, repeatability=3):
    """
    Returns a list of chord names based on mood and difficulty.
    Uses difficulty-appropriate chord pool for more variety at higher levels.
    """
    # Base templates (beginner-safe, using only Em/C/G/D)
    base_templates = {
        "uplifting":  [["G", "D", "Em", "C"], ["C", "G", "D", "Em"], ["Em", "C", "G", "D"]],
        "sad":        [["Em", "C", "G", "D"], ["C", "Em", "D", "G"], ["Em", "G", "D", "C"]],
        "mysterious": [["Em", "D", "C", "D"], ["Em", "C", "D", "Em"], ["Em", "D", "Em", "C"]],
        "nostalgic":  [["Em", "C", "G", "D"], ["C", "G", "Em", "D"], ["Em", "G", "D", "C"]],
        "gritty":     [["G", "D", "Em", "C"], ["Em", "C", "D", "C"], ["G", "D", "C", "D"]],
        "cinematic":  [["Em", "C", "G", "D"], ["Em", "D", "C", "D"], ["Em", "C", "Em", "D"]],
        "driving":    [["G", "D", "Em", "C"], ["C", "G", "D", "C"], ["Em", "C", "G", "D"]],
        "dreamy":     [["Em", "C", "G", "D"], ["C", "G", "Em", "C"], ["Em", "C", "Em", "D"]],
        "tense":      [["Em", "D", "C", "D"], ["Em", "C", "D", "C"], ["Em", "D", "Em", "C"]],
        "soulful":    [["Em", "C", "G", "D"], ["C", "Em", "G", "D"], ["Em", "C", "D", "G"]],
    }

    # Extended templates for intermediate/advanced (use new chords)
    extended_templates = {
        "uplifting":  [["G", "D", "Em", "C"], ["A", "E", "D", "A"], ["G", "Em", "C", "D"]],
        "sad":        [["Am", "F", "C", "G"], ["Em", "Am", "D", "G"], ["Am", "Dm", "E", "Am"]],
        "mysterious": [["Em", "B7", "Am", "Em"], ["Am", "E", "Am", "Dm"], ["Em", "Am", "B7", "Em"]],
        "nostalgic":  [["G", "Em", "C", "D"], ["Am", "F", "C", "E"], ["Em", "C", "Am", "D"]],
        "gritty":     [["E", "A", "D", "A"], ["Am", "E", "Am", "E"], ["G", "D", "Am", "C"]],
        "cinematic":  [["Am", "F", "C", "G"], ["Em", "C", "G", "D"], ["Am", "Dm", "E", "Am"]],
        "driving":    [["A", "D", "E", "A"], ["E", "A", "B7", "E"], ["G", "D", "Em", "C"]],
        "dreamy":     [["Am", "F", "C", "G"], ["Em", "Am", "C", "G"], ["Am", "C", "F", "E"]],
        "tense":      [["Am", "E", "Dm", "E"], ["Em", "B7", "Am", "B7"], ["Am", "Dm", "E", "Am"]],
        "soulful":    [["Am", "Dm", "G", "C"], ["Em", "A", "D", "G"], ["Am", "F", "C", "E"]],
    }

    # Get chord pool based on difficulty
    pool = CHORD_POOLS.get(difficulty, CHORD_POOLS["intermediate"])

    # Select templates based on difficulty
    if difficulty == "beginner":
        templates = base_templates
    else:
        # Mix of base and extended templates
        templates = {}
        for mood_key in base_templates:
            templates[mood_key] = base_templates[mood_key] + extended_templates.get(mood_key, [])

    mood_templates = templates.get(mood, [["Em", "C", "G", "D"]])

    # Difficulty controls stability vs variety
    base_template_prob = 0.70
    if difficulty == "beginner":
        base_template_prob = 0.88
    elif difficulty == "advanced":
        base_template_prob = 0.50

    # Repeatability slider (1=more variety, 5=more repeat/structure)
    rep_adj = (repeatability - 3) * 0.08  # [-0.16 .. +0.16]
    template_prob = max(0.15, min(0.95, base_template_prob + rep_adj))

    # Tension slider nudges toward dominant/tension chords
    tension_bias = MOODS[mood]["tension_bias"]
    tension_factor = (tension - 3) * 0.10  # [-0.20 .. +0.20]
    tension_weight = 1.0 + tension_bias + max(0.0, tension_factor)

    if random.random() < template_prob:
        # Filter templates to only use chords in the current pool
        valid_templates = [t for t in mood_templates if all(c in pool for c in t)]
        if valid_templates:
            prog = list(max(valid_templates, key=lambda t: progression_score(t, loop=True)))
        else:
            prog = list(mood_templates[0])
    else:
        # Generate random progression from pool
        weights = {c: 1.0 for c in pool}
        # Increase weight for tension chords (D, E, B7)
        for tension_chord in ["D", "E", "B7"]:
            if tension_chord in weights:
                weights[tension_chord] = tension_weight

        prog = []
        while len(prog) < length:
            prev = prog[-1] if prog else None
            candidates = [c for c in pool if c != prev]
            w = [weights[c] for c in candidates]
            prog.append(random.choices(candidates, weights=w, k=1)[0])

    # Handle lengths > 4 by extending/varying the base progression
    if length > len(prog):
        base_prog = prog[:]
        while len(prog) < length:
            # Add variation or repeat
            if random.random() < 0.3:
                # Pick a variation from pool
                candidates = [c for c in pool if c != prog[-1]]
                prog.append(random.choice(candidates))
            else:
                # Repeat from base pattern
                prog.append(base_prog[len(prog) % len(base_prog)])

    return prog[:length]


def generate_12_bar_blues(difficulty="intermediate"):
    """
    Generate a classic 12-bar blues progression.
    Uses I-IV-V pattern with difficulty-appropriate chord choices.
    """
    pool = CHORD_POOLS.get(difficulty, CHORD_POOLS["intermediate"])

    # Classic blues in E or A
    if "E" in pool and "A" in pool and "B7" in pool:
        # E blues: E(I) - A(IV) - B7(V)
        return ["E", "E", "E", "E", "A", "A", "E", "E", "B7", "A", "E", "B7"]
    elif "A" in pool and "D" in pool and "E" in pool:
        # A blues: A(I) - D(IV) - E(V)
        return ["A", "A", "A", "A", "D", "D", "A", "A", "E", "D", "A", "E"]
    else:
        # Fallback: Em blues feel
        return ["Em", "Em", "Em", "Em", "Am", "Am", "Em", "Em", "D", "Am", "Em", "D"] if "Am" in pool else \
               ["Em", "Em", "Em", "Em", "C", "C", "Em", "Em", "D", "C", "Em", "D"]


# ----------------------------
# Timeline grid helpers
# ----------------------------
def is_slot_free(used, string, step):
    return (string, step) not in used


def add_event_if_free(events, used, string, fret, step, duration=1):
    if not is_slot_free(used, string, step):
        return False
    events.append({"string": string, "fret": fret, "step": step, "duration": duration})
    used.add((string, step))
    return True


def clamp(x, lo, hi):
    return max(lo, min(hi, x))


# ----------------------------
# Style engines (bar generators)
# Convention: each bar generator returns steps 0-15 only.
# Progression wrapper applies bar offsets.
# ----------------------------
def bar_travis(chord, config):
    """
    Basic Travis feel:
    - bass on 1 and 3 (steps 0, 8)
    - treble on 2 and 4 (steps 4, 12) plus optional extra in-between
    """
    events, used = [], set()

    bass = get_chord_bass(chord)
    treble = get_chord_treble(chord)

    # Bass hits
    add_event_if_free(events, used, bass["string"], bass["fret"], 0)
    add_event_if_free(events, used, bass["string"], bass["fret"], 8)

    # Treble hits (choose 2 distinct if possible)
    t1 = random.choice(treble)
    t2 = random.choice(treble)

    add_event_if_free(events, used, t1["string"], t1["fret"], 4)
    add_event_if_free(events, used, t2["string"], t2["fret"], 12)

    # Optional inner treble (based on density/complexity)
    if random.random() < 0.35 * config["density"]:
        t3 = random.choice(treble)
        add_event_if_free(events, used, t3["string"], t3["fret"], random.choice([2, 6, 10, 14]))

    return events


def bar_arpeggio(chord, config):
    """
    Broken-chord 8ths:
    - hit bass on beat 1 and 3
    - roll through 2-3 treble strings in between
    """
    events, used = [], set()
    bass = get_chord_bass(chord)
    treble = get_chord_treble(chord)

    # Step grid for 8ths in 16-step bar
    steps = [0, 2, 4, 6, 8, 10, 12, 14]

    # Decide roll order (favor open strings if enabled)
    treble_choices = treble[:]
    if config["open_strings"] >= 4:
        treble_choices = sorted(treble_choices, key=lambda n: n["fret"])  # 0-fret first

    roll = [random.choice(treble_choices) for _ in range(6)]

    # Place notes
    treble_i = 0
    for st in steps:
        if st in (0, 8):  # bass anchors
            add_event_if_free(events, used, bass["string"], bass["fret"], st)
        else:
            # 6 non-bass positions in an 8th-note bar; index those contiguously
            note = roll[treble_i % len(roll)]
            treble_i += 1
            add_event_if_free(events, used, note["string"], note["fret"], st)


    # Optional sustained top note (melody knob)
    if config["melody"] >= 4 and random.random() < 0.40:
        top = max(treble, key=lambda n: STRINGS.index(n["string"]))
        add_event_if_free(events, used, top["string"], top["fret"], random.choice([4, 12]), duration=2)

    return events


def bar_crosspick(chord, config):
    """
    Crosspicking/rolling 16ths:
    - continuous roll across 3 strings (G-B-e style)
    """
    events, used = [], set()
    treble = get_chord_treble(chord)

    # Pick 3 treble notes (or reuse if limited)
    picked = random.sample(treble, k=min(3, len(treble)))
    while len(picked) < 3:
        picked.append(random.choice(treble))

    order = [0, 1, 2, 1]  # roll up/down
    # Density controls whether we fill full 16ths or sparser
    use_16ths = config["complexity"] >= 3

    steps = list(range(16)) if use_16ths else [0, 2, 4, 6, 8, 10, 12, 14]
    for i, st in enumerate(steps):
        n = picked[order[i % len(order)]]
        add_event_if_free(events, used, n["string"], n["fret"], st)

    # Light bass support if desired
    if config["bass_movement"] >= 4 and random.random() < 0.35:
        bass = get_chord_bass(chord)
        add_event_if_free(events, used, bass["string"], bass["fret"], 0)
        add_event_if_free(events, used, bass["string"], bass["fret"], 8)

    return events


def bar_strum(chord, config):
    """
    Strum-like: stack bass + 2 treble notes on downbeats.
    """
    events, used = [], set()
    bass = get_chord_bass(chord)
    treble = get_chord_treble(chord)

    # 8th-note strum feel (downbeats emphasized)
    hits = [0, 4, 8, 12]
    if config["complexity"] >= 4:
        hits = [0, 2, 4, 6, 8, 10, 12, 14]

    for st in hits:
        # bass on strong beats
        if st in (0, 8) or random.random() < 0.40:
            add_event_if_free(events, used, bass["string"], bass["fret"], st)
        # treble stack
        n1 = random.choice(treble)
        n2 = random.choice(treble)
        add_event_if_free(events, used, n1["string"], n1["fret"], st)
        # second treble slightly less frequent
        if random.random() < 0.60 * config["density"]:
            add_event_if_free(events, used, n2["string"], n2["fret"], st)

    return events


STYLES = {
    "travis": {"label": "Travis picking", "bar_fn": bar_travis},
    "arpeggio": {"label": "Arpeggio (8ths)", "bar_fn": bar_arpeggio},
    "crosspicking": {"label": "Crosspicking (roll)", "bar_fn": bar_crosspick},
    "strum": {"label": "Strum-like rhythm", "bar_fn": bar_strum},
}


# ----------------------------
# Musical variation / fills
# ----------------------------
def apply_bass_walk_if_possible(events, used, prev_chord, chord, config):
    if config["bass_movement"] <= 2:
        return
    walk = get_bass_walk(prev_chord, chord)
    if walk is None:
        return
    if random.random() > (0.10 + 0.08 * (config["bass_movement"] - 1)):
        return

    # place a 2-step walk near end of bar (steps 12, 14) or mid (6, 7)
    slots = [(12, 14), (6, 7)]
    st1, st2 = random.choice(slots)
    n1 = walk[-2] if len(walk) >= 2 else walk[-1]
    n2 = walk[-1]
    add_event_if_free(events, used, n1["string"], n1["fret"], st1)
    add_event_if_free(events, used, n2["string"], n2["fret"], st2)


def apply_fill(events, used, chord, config, difficulty):
    """
    Very small "fill" near allowed steps. Keeps it safe: just a treble note or quick neighbor.
    """
    d = DIFFICULTIES[difficulty]
    mood = MOODS[config["mood"]]

    # Fill probability scales with mood fill_prob, section boost, intensity, and difficulty fill multiplier
    base = mood["fill_prob"] * SECTIONS[config["section"]]["fill_boost"] * d["fill_multiplier"]
    base *= (0.65 + 0.10 * config["intensity"])  # intensity 1..5
    base = clamp(base, 0.0, 0.95)

    if random.random() > base:
        return

    treble = get_chord_treble(chord)
    allowed_steps = d["allowed_fill_steps"]

    # attempt a few times
    for _ in range(d["fill_attempts_per_bar"]):
        step = random.choice(allowed_steps)
        note = random.choice(treble)

        # Sometimes do a neighbor move (+/- 1 fret if open-ish)
        if config["complexity"] >= 4 and random.random() < 0.45:
            delta = random.choice([-1, 1])
            fret = max(0, note["fret"] + delta)
        else:
            fret = note["fret"]

        if add_event_if_free(events, used, note["string"], fret, step):
            break


def generate_events_for_progression(progression, style, config, difficulty):
    """
    Generates timeline events for all bars using a selected style engine,
    then adds optional bass-walk and fills.
    """
    bar_fn = STYLES[style]["bar_fn"]
    out_events = []

    for bar_index, chord in enumerate(progression):
        bar_events = bar_fn(chord, config)
        # Offset the bar into the full timeline
        offset = bar_index * 16

        # Track used slots within the BAR (for fills/bass-walk), then re-apply offset
        used = set()
        for ev in bar_events:
            used.add((ev["string"], ev["step"]))

        prev_chord = progression[bar_index - 1] if bar_index > 0 else progression[-1]

        # Bass walk (adds bar-local steps)
        apply_bass_walk_if_possible(bar_events, used, prev_chord, chord, config)

        # Fills
        apply_fill(bar_events, used, chord, config, difficulty)

        for ev in bar_events:
            out_events.append(
                {
                    "string": ev["string"],
                    "fret": ev["fret"],
                    "step": ev["step"] + offset,
                    "duration": ev.get("duration", 1),
                }
            )

    return out_events


# ----------------------------
# Save helpers
# ----------------------------
def save_riff_to_file(mood, difficulty, style, bpm, section, knobs, progression, tab_text):
    os.makedirs("riffs", exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{stamp}_{mood}_{difficulty}_{style}_{section}.txt"
    path = os.path.join("riffs", filename)

    with open(path, "w", encoding="utf-8") as f:
        f.write(f"Mood: {mood}\n")
        f.write(f"Difficulty: {difficulty}\n")
        f.write(f"Style: {style}\n")
        f.write(f"Section: {section}\n")
        f.write(f"Tempo: {bpm} BPM\n")
        f.write("Knobs: " + ", ".join([f"{k}={v}" for k, v in knobs.items()]) + "\n")
        f.write("Progression: " + " - ".join(progression) + "\n\n")
        f.write(tab_text)

    # Add to library index
    library.add_to_index(
        filename=filename,
        mood=mood,
        style=style,
        difficulty=difficulty,
        section=section,
        bpm=bpm,
        progression=progression,
        knobs=knobs,
    )

    return path


def save_riff_to_midi(events, mood, difficulty, style, section, bpm):
    """Save the current riff to a MIDI file."""
    if not is_midi_available():
        print(get_midi_install_instructions())
        return None

    os.makedirs("riffs", exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{stamp}_{mood}_{difficulty}_{style}_{section}.mid"
    path = os.path.join("riffs", filename)

    if events_to_midi_file(events, path, bpm=bpm, steps_per_beat=4):
        return path
    return None


# ----------------------------
# Library menu
# ----------------------------
def show_library_menu():
    """Interactive library browser."""
    while True:
        os.system("cls" if os.name == "nt" else "clear")
        stats = library.get_index_stats()

        print("\n" + "=" * 60)
        print("RIFF LIBRARY")
        print("=" * 60)
        print(f"Total riffs: {stats['total']}")
        print()

        print("1) List recent riffs")
        print("2) Search riffs")
        print("3) Filter by mood")
        print("4) Filter by style")
        print("5) View/load a riff")
        print("6) Delete a riff")
        print("7) Rebuild index from files")
        print("q) Back to generator")
        print()

        choice = input("Choose option: ").strip().lower()

        if choice == "q" or choice == "":
            break
        elif choice == "1":
            _list_recent_riffs()
        elif choice == "2":
            _search_riffs()
        elif choice == "3":
            _filter_by_mood()
        elif choice == "4":
            _filter_by_style()
        elif choice == "5":
            _view_riff()
        elif choice == "6":
            _delete_riff()
        elif choice == "7":
            _rebuild_index()


def _list_recent_riffs(limit=10):
    """List recent riffs."""
    riffs = library.list_riffs(limit=limit)

    if not riffs:
        print("\nNo riffs found in library.")
        input("Press Enter to continue...")
        return

    print(f"\nRecent riffs (showing {len(riffs)}):")
    print("-" * 60)
    for i, riff in enumerate(riffs, 1):
        prog_str = " - ".join(riff.get("progression", [])[:4])
        if len(riff.get("progression", [])) > 4:
            prog_str += "..."
        print(f"{i}) [{riff['id']}] {riff['mood']} / {riff['style']} / {riff['bpm']} BPM")
        print(f"   {prog_str}")
    print()
    input("Press Enter to continue...")


def _search_riffs():
    """Search riffs by query."""
    query = input("\nSearch for (chord, mood, style): ").strip()
    if not query:
        return

    results = library.search_riffs(query)

    if not results:
        print(f"\nNo riffs found matching '{query}'.")
        input("Press Enter to continue...")
        return

    print(f"\nFound {len(results)} matching riffs:")
    print("-" * 60)
    for i, riff in enumerate(results[:10], 1):
        prog_str = " - ".join(riff.get("progression", [])[:4])
        print(f"{i}) [{riff['id']}] {riff['mood']} / {riff['style']} / {riff['bpm']} BPM")
        print(f"   {prog_str}")
    print()
    input("Press Enter to continue...")


def _filter_by_mood():
    """Filter riffs by mood."""
    print("\nAvailable moods:", ", ".join(MOODS.keys()))
    mood = input("Filter by mood: ").strip()

    if mood not in MOODS:
        print(f"Unknown mood: {mood}")
        input("Press Enter to continue...")
        return

    riffs = library.list_riffs(filter_mood=mood, limit=10)

    if not riffs:
        print(f"\nNo riffs found with mood '{mood}'.")
        input("Press Enter to continue...")
        return

    print(f"\nRiffs with mood '{mood}':")
    print("-" * 60)
    for i, riff in enumerate(riffs, 1):
        prog_str = " - ".join(riff.get("progression", [])[:4])
        print(f"{i}) [{riff['id']}] {riff['style']} / {riff['bpm']} BPM")
        print(f"   {prog_str}")
    print()
    input("Press Enter to continue...")


def _filter_by_style():
    """Filter riffs by style."""
    print("\nAvailable styles:", ", ".join(STYLES.keys()))
    style = input("Filter by style: ").strip()

    if style not in STYLES:
        print(f"Unknown style: {style}")
        input("Press Enter to continue...")
        return

    riffs = library.list_riffs(filter_style=style, limit=10)

    if not riffs:
        print(f"\nNo riffs found with style '{style}'.")
        input("Press Enter to continue...")
        return

    print(f"\nRiffs with style '{style}':")
    print("-" * 60)
    for i, riff in enumerate(riffs, 1):
        prog_str = " - ".join(riff.get("progression", [])[:4])
        print(f"{i}) [{riff['id']}] {riff['mood']} / {riff['bpm']} BPM")
        print(f"   {prog_str}")
    print()
    input("Press Enter to continue...")


def _view_riff():
    """View a specific riff by ID."""
    riff_id = input("\nEnter riff ID (e.g., 20260127_170206): ").strip()
    if not riff_id:
        return

    riff_entry, content = library.get_riff_content(riff_id)

    if not riff_entry:
        print(f"\nRiff '{riff_id}' not found.")
        input("Press Enter to continue...")
        return

    os.system("cls" if os.name == "nt" else "clear")
    print("\n" + "=" * 60)
    print(f"RIFF: {riff_id}")
    print("=" * 60)
    print(f"Mood: {riff_entry.get('mood')}")
    print(f"Style: {riff_entry.get('style')}")
    print(f"Difficulty: {riff_entry.get('difficulty')}")
    print(f"Section: {riff_entry.get('section')}")
    print(f"BPM: {riff_entry.get('bpm')}")
    print(f"Progression: {' - '.join(riff_entry.get('progression', []))}")
    print()

    if content:
        # Find where tab starts (after the header)
        lines = content.split("\n")
        tab_start = 0
        for i, line in enumerate(lines):
            if line.startswith("e|") or line.startswith("  "):
                tab_start = i
                break
        print("\n".join(lines[tab_start:]))
    else:
        print("(File content not available)")

    print()
    input("Press Enter to continue...")


def _delete_riff():
    """Delete a riff by ID."""
    riff_id = input("\nEnter riff ID to delete: ").strip()
    if not riff_id:
        return

    confirm = input(f"Delete riff '{riff_id}'? (y/N): ").strip().lower()
    if confirm != "y":
        print("Cancelled.")
        input("Press Enter to continue...")
        return

    if library.delete_riff(riff_id):
        print(f"Riff '{riff_id}' deleted.")
    else:
        print(f"Riff '{riff_id}' not found.")
    input("Press Enter to continue...")


def _rebuild_index():
    """Rebuild the index from existing files."""
    print("\nRebuilding index from files...")
    count = library.rebuild_index_from_files()
    print(f"Indexed {count} riffs.")
    input("Press Enter to continue...")


# ----------------------------
# Main loop
# ----------------------------
def build_config(mood, difficulty, section, intensity, complexity, open_strings, bass_movement, melody, tension, repeatability):
    sec = SECTIONS[section]
    # density baseline from section + intensity/complexity
    density = (0.75 + 0.10 * intensity) * sec["density"]
    density = clamp(density, 0.55, 1.45)

    return {
        "mood": mood,
        "difficulty": difficulty,
        "section": section,
        "intensity": intensity,         # 1..5
        "complexity": complexity,       # 1..5
        "open_strings": open_strings,   # 1..5
        "bass_movement": bass_movement, # 1..5
        "melody": melody,               # 1..5
        "tension": tension,             # 1..5
        "repeatability": repeatability, # 1..5
        "density": density,
    }


def parse_cli_args():
    """
    Supported CLI args (all optional):
      python main.py [mood] [difficulty] [style]
    Everything else is interactive.
    """
    mood = None
    difficulty = None
    style = None

    if len(sys.argv) > 1 and sys.argv[1] in MOODS:
        mood = sys.argv[1]
    if len(sys.argv) > 2 and sys.argv[2] in DIFFICULTIES:
        difficulty = sys.argv[2]
    if len(sys.argv) > 3 and sys.argv[3] in STYLES:
        style = sys.argv[3]

    return mood, difficulty, style


def run():
    cli_mood, cli_difficulty, cli_style = parse_cli_args()

    mood = cli_mood or choose_from_menu("Choose a mood:", MOODS, "uplifting")
    difficulty = cli_difficulty or choose_from_menu("Choose a difficulty:", DIFFICULTIES, "intermediate")
    style = cli_style or choose_from_menu("Choose a style:", STYLES, "travis")
    section = choose_from_menu("Choose a section:", SECTIONS, "verse")
    length_choice = choose_from_menu("Choose progression length:", PROGRESSION_LENGTHS, "4-bar")
    prog_length = PROGRESSION_LENGTHS[length_choice]

    # Customization knobs (1..5) — Enter for defaults
    intensity = choose_int_in_range("Intensity", 1, 5, 3)
    complexity = choose_int_in_range("Complexity", 1, 5, 3)
    open_strings = choose_int_in_range("More open strings", 1, 5, 3)
    bass_movement = choose_int_in_range("More bass movement", 1, 5, 3)
    melody = choose_int_in_range("More melodic top line", 1, 5, 3)
    tension = choose_int_in_range("More tension", 1, 5, 3)
    repeatability = choose_int_in_range("Repeatability", 1, 5, 3)

    cfg = build_config(
        mood=mood,
        difficulty=difficulty,
        section=section,
        intensity=intensity,
        complexity=complexity,
        open_strings=open_strings,
        bass_movement=bass_movement,
        melody=melody,
        tension=tension,
        repeatability=repeatability,
    )

    while True:
        os.system("cls" if os.name == "nt" else "clear")

        bpm_low, bpm_high = MOODS[mood]["tempo_range"]
        bpm = random.randint(bpm_low, bpm_high)

        # Generate progression based on length choice
        if prog_length == 12 and "blues" in length_choice.lower():
            progression = generate_12_bar_blues(difficulty=difficulty)
        else:
            progression = generate_progression(
                mood=mood,
                length=prog_length,
                difficulty=difficulty,
                tension=tension,
                repeatability=repeatability,
            )

        print("\n" + "=" * 60)
        print(f"Mood: {mood} | Difficulty: {difficulty} | Style: {style} | Section: {section} | Tempo: {bpm} BPM | Bars: {len(progression)}")
        print("Knobs: " + ", ".join([
            f"intensity={intensity}",
            f"complexity={complexity}",
            f"open={open_strings}",
            f"bass_move={bass_movement}",
            f"melody={melody}",
            f"tension={tension}",
            f"repeat={repeatability}",
        ]))
        print(f"Progression: {' - '.join(progression)}")
        print("=" * 60 + "\n")

        events = generate_events_for_progression(progression, style=style, config=cfg, difficulty=difficulty)
        tab_text = render_tab(events, steps=len(progression) * 16, progression=progression)
        print(tab_text)

        # Build action prompt based on available features
        play_hint = "p=play | " if is_audio_available() else ""
        midi_hint = "m=midi | " if is_midi_available() else ""
        action = input(f"\n[Enter]=again | {play_hint}s=save | {midi_hint}l=library | q=quit : ").strip().lower()

        if action == "q":
            break
        elif action == "p":
            if is_audio_available():
                print(f"\nPlaying at {bpm} BPM... (wait for playback to finish)")
                play_events(events, bpm, steps_per_beat=4, blocking=True)
                print("Playback finished.")
            else:
                print(get_audio_install_instructions())
            input("Press Enter to continue...")
        elif action == "s":
            knobs = {
                "intensity": intensity,
                "complexity": complexity,
                "open_strings": open_strings,
                "bass_movement": bass_movement,
                "melody": melody,
                "tension": tension,
                "repeatability": repeatability,
            }
            path = save_riff_to_file(mood, difficulty, style, bpm, section, knobs, progression, tab_text)
            print(f"Saved to: {path}")
            input("Press Enter to continue...")
        elif action == "m":
            midi_path = save_riff_to_midi(events, mood, difficulty, style, section, bpm)
            if midi_path:
                print(f"MIDI saved to: {midi_path}")
            else:
                print("Failed to save MIDI file.")
            input("Press Enter to continue...")
        elif action == "l":
            show_library_menu()


if __name__ == "__main__":
    run()
