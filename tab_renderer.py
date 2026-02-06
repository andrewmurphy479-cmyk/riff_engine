def render_tab(events, steps=16, progression=None, steps_per_bar=16, bars_per_line=4):
    """
    Render guitar tab from events.

    Args:
        events: List of note events with string, fret, step, duration
        steps: Total number of steps in the tab
        progression: List of chord names for labels
        steps_per_bar: Steps per bar (default 16 for 16th note resolution)
        bars_per_line: Maximum bars to display per line (for wrapping long progressions)
    """
    strings = ["e", "B", "G", "D", "A", "E"]
    tab = {s: ["-"] * steps for s in strings}

    for event in events:
        string = event["string"]
        step = event["step"]
        fret = str(event["fret"])
        if 0 <= step < steps:
            tab[string][step] = fret

    # Calculate total bars
    total_bars = (steps + steps_per_bar - 1) // steps_per_bar

    # Build output with line wrapping for long progressions
    all_lines = []

    for line_start_bar in range(0, total_bars, bars_per_line):
        line_end_bar = min(line_start_bar + bars_per_line, total_bars)
        start_step = line_start_bar * steps_per_bar
        end_step = min(line_end_bar * steps_per_bar, steps)

        line_group = []

        # Chord labels line for this row
        if progression:
            label_line = "  "
            for bar_idx in range(line_start_bar, line_end_bar):
                if bar_idx < len(progression):
                    label_line += progression[bar_idx].ljust(steps_per_bar) + "|"
                else:
                    label_line += " " * steps_per_bar + "|"
            line_group.append(label_line)

        # Tab lines for this row
        for s in strings:
            line = s + "|"
            for i in range(start_step, end_step):
                line += tab[s][i]
                if (i + 1) % steps_per_bar == 0:
                    line += "|"
            line_group.append(line)

        all_lines.extend(line_group)

        # Add blank line between rows (except after last row)
        if line_end_bar < total_bars:
            all_lines.append("")

    tab_text = "\n".join(all_lines)

    # Still print to screen
    print(tab_text)

    return tab_text
