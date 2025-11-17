import React from "react";

// Lightweight WebAudio blip for feedback (no external deps)
const playBlip = (freq = 440, durationMs = 180, volume = 0.05) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, durationMs);
  } catch {}
};

const GROUP_ICONS = {
  Type: "🎸",
  Timbre: "🌈",
  Genre: "🎶",
  Articulation: "⚙️",
  Character: "💫",
  Emotional: "💖",
};

const EMO_COLORS = {
  Melancholic: "from-slate-700 to-sky-700",
  Epic: "from-red-700 to-amber-600",
  Gentle: "from-rose-400 to-pink-500",
  Energetic: "from-orange-600 to-yellow-500",
};

const TagChip = ({ label, active, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    className={`px-2.5 py-1 rounded-full text-xs border transition-all duration-200 backdrop-blur-sm shadow-sm hover:shadow ${
      active
        ? "bg-orange-600/90 border-orange-500 text-white hover:brightness-110"
        : "bg-gray-800/70 border-gray-700 text-gray-200 hover:bg-gray-700/80"
    }`}
  >
    #{label}
  </button>
);

const EmotionCard = ({ label, active, onToggle }) => {
  const gradient = EMO_COLORS[label] || "from-indigo-600 to-purple-600";
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative group rounded-lg p-3 text-left border transition-all duration-200 overflow-hidden ${
        active
          ? "border-orange-400 ring-2 ring-orange-400/40"
          : "border-gray-700"
      }`}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-30 group-hover:opacity-40 transition-opacity`}
      />
      <div className="relative">
        <div className="text-[11px] text-gray-300">Emotion</div>
        <div className="text-white font-semibold">#{label}</div>
      </div>
    </button>
  );
};

const TagFlowBoard = ({
  groups,
  selected = [],
  onToggle,
  enableAudio = true,
}) => {
  const [activeTab, setActiveTab] = React.useState(
    Object.keys(groups)[0] || ""
  );

  const handleToggle = (group, tag) => {
    if (enableAudio && (group === "Genre" || group === "Timbre")) {
      // Map some simple tones
      const freq = group === "Genre" ? 330 : 660;
      playBlip(freq, 140, 0.04);
    }
    onToggle(tag);
  };

  return (
    <div>
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.keys(groups).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setActiveTab(g)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
              activeTab === g
                ? "bg-gray-800 border-gray-600 text-white"
                : "bg-gray-900 border-gray-800 text-gray-300 hover:bg-gray-800"
            }`}
          >
            <span className="mr-1">{GROUP_ICONS[g] || ""}</span>
            {g}
          </button>
        ))}
      </div>

      {/* Content */}
      {Object.entries(groups).map(([group, items]) => (
        <div
          key={group}
          className={`${activeTab === group ? "block" : "hidden"}`}
        >
          <div className="flex flex-wrap gap-2">
            {items.map((t) => (
              <TagChip
                key={t}
                label={t}
                active={selected.includes(t)}
                onToggle={() => handleToggle(group, t)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TagFlowBoard;
