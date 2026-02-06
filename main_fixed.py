import random
import sys
import os
from datetime import datetime

from tab_renderer import render_tab

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


# ----------------------------
# Progression generation
# ----------------------------
def progression_score(prog, loop=True):
    """Higher = smoother (very simple heuristic)."""
    # Prefer stepwise roots Em->C->G->D-ish movement (subjective)
    root_rank = {"Em": 0, "C": 1, "G": 2, "D": 3}
    score = 0.0
    for i in range(1, len(prog)):
        score += 1.0 - min(1.0, abs(root_rank[prog[i]] - root_rank[prog[i - 1]]) / 3.0)
    if loop and len(prog) > 1:
        score += 1.0 - min(1.0, abs(root_rank[prog[0]] - root_rank[prog[-1]]) / 3.0)
    return score


def generate_progression(mood, length=4, difficulty="intermediate", tension=3, repeatability=3):
    """
    Returns a list of chord names based on mood.
    Still uses Em/C/G/D universe, but can vary feel with 'tension' + 'repeatability'.
    """
    # Base templates
    templates = {
        "uplifting":  [["G", "D", "Em", "C"], ["C", "G", "D", "Em"], ["Em", "C", "G", "D"]],
        "sad":        [["Em", "C", "G", "D"], ["C", "Em", "D", "G"], ["Em", "G", "D", "C"]],
        "mysterious": [["Em", "D", "C", "D"], ["Em", "C", "D", "Em"], ["Em", "D", "Em", "C"]],
        # New moods borrow templates for feel
        "nostalgic":  [["Em", "C", "G", "D"], ["C", "G", "Em", "D"], ["Em", "G", "D", "C"]],
        "gritty":     [["G", "D", "Em", "C"], ["Em", "C", "D", "C"], ["G", "D", "C", "D"]],
        "cinematic":  [["Em", "C", "G", "D"], ["Em", "D", "C", "D"], ["Em", "C", "Em", "D"]],
        "driving":    [["G", "D", "Em", "C"], ["C", "G", "D", "C"], ["Em", "C", "G", "D"]],
        "dreamy":     [["Em", "C", "G", "D"], ["C", "G", "Em", "C"], ["Em", "C", "Em", "D"]],
        "tense":      [["Em", "D", "C", "D"], ["Em", "C", "D", "C"], ["Em", "D", "Em", "C"]],
        "soulful":    [["Em", "C", "G", "D"], ["C", "Em", "G", "D"], ["Em", "C", "D", "G"]],
    }
    pool = ["Em", "C", "G", "D"]
    mood_templates = templates.get(mood, [["Em", "C", "G", "D"]])

    # Difficulty controls stability vs variety
    base_template_prob = 0.70
    if difficulty == "beginner":
        base_template_prob = 0.88
    elif difficulty == "advanced":
        base_template_prob = 0.50

    # Repeatability slider (1=more variety, 5=more repeat/structure)
    # Map repeatability 1..5 -> adjust template probability
    rep_adj = (repeatability - 3) * 0.08  # [-0.16 .. +0.16]
    template_prob = max(0.15, min(0.95, base_template_prob + rep_adj))

    # Tension slider nudges toward more D usage and "Em-D-C-D" feel
    tension_bias = MOODS[mood]["tension_bias"]
    tension_factor = (tension - 3) * 0.10  # [-0.20 .. +0.20]
    d_weight = 1.0 + tension_bias + max(0.0, tension_factor)

    if random.random() < template_prob:
        prog = max(mood_templates, key=lambda t: progression_score(t, loop=True))
    else:
        weights = {"Em": 1.0, "C": 1.0, "G": 1.0, "D": d_weight}
        prog = []
        while len(prog) < length:
            prev = prog[-1] if prog else None
            candidates = [c for c in pool if c != prev]
            w = [weights[c] for c in candidates]
            prog.append(random.choices(candidates, weights=w, k=1)[0])

    return prog[:length]


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

    bass = CHORD_BASS[chord]
    treble = CHORD_TREBLE_NOTES[chord]

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
    bass = CHORD_BASS[chord]
    treble = CHORD_TREBLE_NOTES[chord]

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
            # We have 6 non-bass positions in an 8th-note bar; index those contiguously
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
    treble = CHORD_TREBLE_NOTES[chord]

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
        bass = CHORD_BASS[chord]
        add_event_if_free(events, used, bass["string"], bass["fret"], 0)
        add_event_if_free(events, used, bass["string"], bass["fret"], 8)

    return events


def bar_strum(chord, config):
    """
    Strum-like: stack bass + 2 treble notes on downbeats.
    """
    events, used = [], set()
    bass = CHORD_BASS[chord]
    treble = CHORD_TREBLE_NOTES[chord]

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
    key = (prev_chord, chord)
    if key not in BASS_WALKS:
        return
    if random.random() > (0.10 + 0.08 * (config["bass_movement"] - 1)):
        return

    walk = BASS_WALKS[key]
    # place a 2-step walk near end of bar (steps 12, 14) or mid (6, 7)
    slots = [(12, 14), (6, 7)]
    st1, st2 = random.choice(slots)
    n1 = walk[-2]
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

    treble = CHORD_TREBLE_NOTES[chord]
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

    return path


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

        progression = generate_progression(
            mood=mood,
            length=4,
            difficulty=difficulty,
            tension=tension,
            repeatability=repeatability,
        )

        print("\n" + "=" * 60)
        print(f"Mood: {mood} | Difficulty: {difficulty} | Style: {style} | Section: {section} | Tempo: {bpm} BPM")
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

        action = input("\n[Enter]=again | s=save | q=quit : ").strip().lower()
        if action == "q":
            break
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


if __name__ == "__main__":
    run()
