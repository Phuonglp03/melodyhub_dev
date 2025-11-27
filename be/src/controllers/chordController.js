import Chord from "../models/Chord.js";
import DEFAULT_CHORDS from "../data/defaultChords.js";

// Helper function to check if chord is basic (no extensions)
const isBasicChord = (chordName) => {
  if (!chordName) return false;
  const name = chordName.toLowerCase();
  // Complex patterns: 7, 9, 11, 13, sus, add, maj7, dim7, aug7, m7, b5, #5, 6, etc.
  const complexPatterns = /(7|9|11|13|sus|add|maj7|dim7|aug7|m7|b5|#5|6|maj9|9th)/;
  
  // If it contains complex patterns, it's not basic
  if (complexPatterns.test(name)) return false;
  
  // Basic chords are: major (C, D, E, etc.), minor (Am, Bm, etc.), diminished (dim), augmented (aug)
  // Check if it's a simple major chord (just letter, maybe with # or b)
  const simpleMajor = /^[a-g][#b]?$/i.test(chordName);
  // Check if it's a simple minor chord (letter + m, maybe with # or b)
  const simpleMinor = /^[a-g][#b]?m$/i.test(chordName);
  // Check if it's diminished or augmented
  const dimAug = /dim$|aug$/i.test(chordName);
  
  return simpleMajor || simpleMinor || dimAug;
};

export const listChords = async (req, res) => {
  try {
    const { basicOnly = false, limit, skip = 0, key } = req.query;
    
    let query = {};
    
    // Filter by key if provided (for future use)
    if (key) {
      // This can be enhanced to filter chords that belong to a key
    }
    
    let chords = await Chord.find(query).sort({ chordName: 1 });

    if (!chords.length && DEFAULT_CHORDS.length) {
      chords = await Chord.insertMany(DEFAULT_CHORDS);
      chords = await Chord.find(query).sort({ chordName: 1 });
    }

    // Filter basic chords if requested
    if (basicOnly === 'true' || basicOnly === true) {
      chords = chords.filter(chord => isBasicChord(chord.chordName));
    }

    // Apply pagination
    const total = chords.length;
    if (limit) {
      const limitNum = parseInt(limit, 10);
      const skipNum = parseInt(skip, 10);
      chords = chords.slice(skipNum, skipNum + limitNum);
    }

    res.json({
      success: true,
      data: chords,
      total,
      limit: limit ? parseInt(limit, 10) : null,
      skip: parseInt(skip, 10),
    });
  } catch (error) {
    console.error("[ChordController] Failed to fetch chords:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch chords",
      error: error.message,
    });
  }
};

