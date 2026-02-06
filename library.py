"""
Riff library management for the riff engine.
Provides indexing, searching, and browsing of saved riffs.
"""

import os
import json
import re
from datetime import datetime

RIFFS_DIR = "riffs"
INDEX_FILE = os.path.join(RIFFS_DIR, "index.json")
INDEX_VERSION = 1


def _ensure_riffs_dir():
    """Ensure the riffs directory exists."""
    os.makedirs(RIFFS_DIR, exist_ok=True)


def load_index():
    """
    Load the riff index from disk.

    Returns:
        dict with 'version' and 'riffs' keys, or empty index if not found
    """
    _ensure_riffs_dir()

    if not os.path.exists(INDEX_FILE):
        return {"version": INDEX_VERSION, "riffs": []}

    try:
        with open(INDEX_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            # Ensure version compatibility
            if data.get("version", 0) < INDEX_VERSION:
                # Could add migration logic here
                pass
            return data
    except (json.JSONDecodeError, IOError):
        return {"version": INDEX_VERSION, "riffs": []}


def save_index(index):
    """
    Save the riff index to disk.

    Args:
        index: dict with 'version' and 'riffs' keys
    """
    _ensure_riffs_dir()

    index["version"] = INDEX_VERSION

    try:
        with open(INDEX_FILE, "w", encoding="utf-8") as f:
            json.dump(index, f, indent=2)
        return True
    except IOError as e:
        print(f"Error saving index: {e}")
        return False


def add_to_index(filename, mood, style, difficulty, section, bpm, progression, knobs=None):
    """
    Add a riff to the index.

    Args:
        filename: Name of the riff file (not full path)
        mood: Mood setting used
        style: Style setting used
        difficulty: Difficulty level
        section: Section type
        bpm: Tempo in BPM
        progression: List of chord names
        knobs: Optional dict of knob settings

    Returns:
        The riff ID (timestamp-based)
    """
    index = load_index()

    # Generate ID from filename timestamp or current time
    match = re.match(r"(\d{8}_\d{6})", filename)
    if match:
        riff_id = match.group(1)
    else:
        riff_id = datetime.now().strftime("%Y%m%d_%H%M%S")

    # Check if already exists
    for riff in index["riffs"]:
        if riff["id"] == riff_id or riff["filename"] == filename:
            # Update existing entry
            riff.update({
                "mood": mood,
                "style": style,
                "difficulty": difficulty,
                "section": section,
                "bpm": bpm,
                "progression": progression,
                "knobs": knobs or {},
            })
            save_index(index)
            return riff_id

    # Add new entry
    riff_entry = {
        "id": riff_id,
        "filename": filename,
        "mood": mood,
        "style": style,
        "difficulty": difficulty,
        "section": section,
        "bpm": bpm,
        "progression": progression,
        "knobs": knobs or {},
    }

    index["riffs"].append(riff_entry)
    save_index(index)

    return riff_id


def list_riffs(filter_mood=None, filter_style=None, filter_difficulty=None, limit=None):
    """
    List riffs from the index with optional filtering.

    Args:
        filter_mood: Only show riffs with this mood
        filter_style: Only show riffs with this style
        filter_difficulty: Only show riffs with this difficulty
        limit: Maximum number of riffs to return

    Returns:
        List of riff entries matching the filters
    """
    index = load_index()
    riffs = index["riffs"]

    # Apply filters
    if filter_mood:
        riffs = [r for r in riffs if r.get("mood") == filter_mood]
    if filter_style:
        riffs = [r for r in riffs if r.get("style") == filter_style]
    if filter_difficulty:
        riffs = [r for r in riffs if r.get("difficulty") == filter_difficulty]

    # Sort by ID (newest first)
    riffs = sorted(riffs, key=lambda r: r.get("id", ""), reverse=True)

    # Apply limit
    if limit:
        riffs = riffs[:limit]

    return riffs


def search_riffs(query):
    """
    Search riffs by chord, mood, style, or other text.

    Args:
        query: Search string (case-insensitive)

    Returns:
        List of matching riff entries
    """
    index = load_index()
    query_lower = query.lower()
    results = []

    for riff in index["riffs"]:
        # Search in mood, style, difficulty, section
        searchable = [
            riff.get("mood", ""),
            riff.get("style", ""),
            riff.get("difficulty", ""),
            riff.get("section", ""),
        ]

        # Search in progression chords
        progression = riff.get("progression", [])
        searchable.extend(progression)

        # Check if query matches any field
        if any(query_lower in str(s).lower() for s in searchable):
            results.append(riff)

    # Sort by ID (newest first)
    results = sorted(results, key=lambda r: r.get("id", ""), reverse=True)

    return results


def get_riff_content(riff_id):
    """
    Get the full content of a riff file.

    Args:
        riff_id: The riff ID to retrieve

    Returns:
        Tuple of (riff_entry, file_content) or (None, None) if not found
    """
    index = load_index()

    # Find the riff entry
    riff_entry = None
    for riff in index["riffs"]:
        if riff["id"] == riff_id:
            riff_entry = riff
            break

    if not riff_entry:
        return None, None

    # Read the file content
    filepath = os.path.join(RIFFS_DIR, riff_entry["filename"])
    if not os.path.exists(filepath):
        return riff_entry, None

    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        return riff_entry, content
    except IOError:
        return riff_entry, None


def delete_riff(riff_id):
    """
    Delete a riff from the index and optionally from disk.

    Args:
        riff_id: The riff ID to delete

    Returns:
        True if deleted, False if not found
    """
    index = load_index()

    # Find and remove the riff entry
    for i, riff in enumerate(index["riffs"]):
        if riff["id"] == riff_id:
            # Remove from index
            removed = index["riffs"].pop(i)
            save_index(index)

            # Optionally delete the file
            filepath = os.path.join(RIFFS_DIR, removed["filename"])
            if os.path.exists(filepath):
                try:
                    os.remove(filepath)
                except IOError:
                    pass  # File deletion is optional

            # Also try to delete corresponding MIDI file
            midi_path = filepath.rsplit(".", 1)[0] + ".mid"
            if os.path.exists(midi_path):
                try:
                    os.remove(midi_path)
                except IOError:
                    pass

            return True

    return False


def rebuild_index_from_files():
    """
    Rebuild the index by scanning all .txt files in the riffs directory.
    Useful for backward compatibility with existing riff files.

    Returns:
        Number of riffs indexed
    """
    _ensure_riffs_dir()

    # Start fresh
    index = {"version": INDEX_VERSION, "riffs": []}

    # Scan for riff files
    if not os.path.exists(RIFFS_DIR):
        return 0

    count = 0
    for filename in os.listdir(RIFFS_DIR):
        if not filename.endswith(".txt"):
            continue
        if filename == "index.json":
            continue

        filepath = os.path.join(RIFFS_DIR, filename)

        # Parse file header to extract metadata
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()

            # Extract metadata from file content
            mood = _extract_field(content, "Mood")
            difficulty = _extract_field(content, "Difficulty")
            style = _extract_field(content, "Style")
            section = _extract_field(content, "Section")
            bpm_str = _extract_field(content, "Tempo")
            bpm = int(bpm_str.replace(" BPM", "")) if bpm_str else 120
            progression_str = _extract_field(content, "Progression")
            progression = progression_str.split(" - ") if progression_str else []

            # Extract knobs if present
            knobs_str = _extract_field(content, "Knobs")
            knobs = {}
            if knobs_str:
                for part in knobs_str.split(", "):
                    if "=" in part:
                        k, v = part.split("=", 1)
                        try:
                            knobs[k.strip()] = int(v.strip())
                        except ValueError:
                            knobs[k.strip()] = v.strip()

            # Generate ID from filename
            match = re.match(r"(\d{8}_\d{6})", filename)
            riff_id = match.group(1) if match else datetime.now().strftime("%Y%m%d_%H%M%S")

            riff_entry = {
                "id": riff_id,
                "filename": filename,
                "mood": mood or "unknown",
                "style": style or "unknown",
                "difficulty": difficulty or "intermediate",
                "section": section or "verse",
                "bpm": bpm,
                "progression": progression,
                "knobs": knobs,
            }

            index["riffs"].append(riff_entry)
            count += 1

        except (IOError, ValueError):
            continue

    save_index(index)
    return count


def _extract_field(content, field_name):
    """Extract a field value from riff file content."""
    pattern = rf"^{field_name}:\s*(.+)$"
    match = re.search(pattern, content, re.MULTILINE)
    if match:
        return match.group(1).strip()
    return None


def get_index_stats():
    """
    Get statistics about the riff library.

    Returns:
        dict with counts by mood, style, difficulty, etc.
    """
    index = load_index()
    riffs = index["riffs"]

    stats = {
        "total": len(riffs),
        "by_mood": {},
        "by_style": {},
        "by_difficulty": {},
    }

    for riff in riffs:
        mood = riff.get("mood", "unknown")
        style = riff.get("style", "unknown")
        difficulty = riff.get("difficulty", "unknown")

        stats["by_mood"][mood] = stats["by_mood"].get(mood, 0) + 1
        stats["by_style"][style] = stats["by_style"].get(style, 0) + 1
        stats["by_difficulty"][difficulty] = stats["by_difficulty"].get(difficulty, 0) + 1

    return stats
