import React from "react";

/**
 * Converts chord quality to jazz notation symbols (iReal Pro style)
 * - maj7 → Δ7
 * - m/min → –
 * - m7b5/half-dim → ø7
 * - dim → o
 * - aug → +
 */
const formatChordNotation = (chordName) => {
  if (!chordName) return "";

  const match = chordName.match(/^([A-G][#b]?)(.*)$/i);
  if (!match) return chordName;

  const root = match[1];
  let quality = match[2].trim();

  if (!quality) {
    // No quality = major chord, just show root
    return root;
  }

  // Normalize quality string
  const q = quality.toLowerCase().replace(/\s+/g, "");

  // Half-diminished: m7b5, ø, half-dim, mi7b5
  if (/m7b5|ø|half|mi7b5|m7\(b5\)/.test(q)) {
    return `${root}ø7`;
  }

  // Diminished: dim, °, o (but not half-dim)
  if ((/dim|°/.test(q) || q === "o") && !/m7b5|half|ø/.test(q)) {
    // Check if it's dim7
    if (/dim7|°7/.test(q)) {
      return `${root}o7`;
    }
    return `${root}o`;
  }

  // Augmented: aug, +
  if (/aug|^\+$/.test(q)) {
    return `${root}+`;
  }

  // Major 7th: maj7, M7, Δ7, Δ (exclude m7 which is minor 7th)
  if (/maj7|M7|^Δ7$|^Δ$/.test(q) || q === "maj7" || q === "M7") {
    // Check if it's specifically maj7 or just major
    if (/maj7|M7|^Δ7$/.test(q) || q === "maj7" || q === "M7") {
      return `${root}Δ7`;
    }
    // Just major (no 7th)
    if (/maj$|^M$/.test(q) && !/maj7|M7|m7/.test(q)) {
      return root; // Just show root for plain major
    }
    return `${root}Δ`;
  }

  // Minor: m, min, - (but not m7, m9, etc.)
  if ((/^m$|^min$|^-$/.test(q) || q === "m" || q === "min") && !/^m[0-9]|^min[0-9]/.test(q)) {
    return `${root}–`;
  }

  // Minor 7th: m7, min7, -7
  if (/^m7$|^min7$|^-7$/.test(q)) {
    return `${root}–7`;
  }

  // Minor with extensions: m9, m11, m13, -9, etc.
  if (/^m[0-9]|^min[0-9]|^-[0-9]/.test(q)) {
    const ext = quality.match(/[0-9]+/)?.[0] || "";
    return `${root}–${ext}`;
  }

  // Dominant 7th: 7, 9, 11, 13 (without maj/min)
  if (/^7$|^9$|^11$|^13$/.test(q)) {
    return `${root}${quality}`;
  }

  // Dominant with alterations: 7b9, 7#9, 7♭9, 7sus4, etc.
  if (/^7/.test(q)) {
    // Replace flat/sharp symbols for consistent display
    const displayQuality = quality.replace(/♭/g, "b").replace(/♯/g, "#");
    return `${root}${displayQuality}`;
  }

  // Sus chords: sus, sus4, sus2
  if (/sus/.test(q)) {
    return `${root}${quality}`;
  }

  // For other qualities, show as-is but clean up common patterns
  let cleanQuality = quality
    .replace(/maj/gi, "Δ")
    .replace(/min/gi, "m")
    .replace(/♭/g, "b")
    .replace(/♯/g, "#");
  
  return `${root}${cleanQuality}`;
};

const ChordBlock = ({ chordName, isSelected = false, onClick, className = "" }) => {
  const displayText = formatChordNotation(chordName);

  return (
    <div
      onClick={onClick}
      className={[
        "relative w-full h-full flex items-center justify-center px-2",
        "border-r border-gray-700/20",
        "transition-colors duration-100 cursor-pointer",
        isSelected
          ? "bg-blue-500/15 border-r-blue-400/60"
          : "bg-transparent hover:bg-white/5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {chordName ? (
        <span
          className={[
            "text-base font-normal text-gray-200 select-none",
            "font-['Helvetica Neue','Helvetica','Arial',sans-serif]",
            "tracking-tight",
            isSelected ? "text-blue-300 font-medium" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {displayText}
        </span>
      ) : (
        <span className="text-gray-500 text-lg">+</span>
      )}
    </div>
  );
};

export default ChordBlock;
