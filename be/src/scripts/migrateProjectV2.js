// scripts/migrateProjectsV2.js
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import Project from "../models/Project.js";

const DEFAULT_MEMBERS = [
  {
    instanceId: "default-drums",
    name: "Drums",
    type: "drums",
    role: "rhythm",
    soundBank: "jazz-kit",
    volume: 0.8,
  },
  {
    instanceId: "default-bass",
    name: "Bass",
    type: "bass",
    role: "bass",
    soundBank: "upright",
    volume: 0.78,
  },
  {
    instanceId: "default-piano",
    name: "Piano",
    type: "piano",
    role: "comping",
    soundBank: "grand-piano",
    volume: 0.76,
  },
];

const buildSectionsFromProgression = (chords = []) => {
  if (!chords.length) {
    return [
      {
        id: "section-1",
        label: "A",
        bars: [{ chord: "Cmaj7", beatCount: 4 }],
      },
    ];
  }
  const bars = chords.map((chord) => ({ chord, beatCount: 4 }));
  const sections = [];
  for (let i = 0; i < bars.length; i += 8) {
    sections.push({
      id: `section-${sections.length + 1}`,
      label: sections.length === 0 ? "A" : "B",
      bars: bars.slice(i, i + 8),
    });
  }
  return sections;
};

const buildMembersFromLegacy = (project) => {
  const volumes = project.bandSettings?.volumes || {
    drums: 0.8,
    bass: 0.8,
    piano: 0.8,
  };
  const mutes = project.bandSettings?.mutes || {
    drums: false,
    bass: false,
    piano: false,
  };

  return DEFAULT_MEMBERS.map((member) => {
    if (member.type === "drums") {
      return {
        ...member,
        volume: volumes.drums ?? member.volume,
        isMuted: mutes.drums ?? false,
      };
    }
    if (member.type === "bass") {
      return {
        ...member,
        volume: volumes.bass ?? member.volume,
        isMuted: mutes.bass ?? false,
      };
    }
    if (member.type === "piano") {
      return {
        ...member,
        volume: volumes.piano ?? member.volume,
        isMuted: mutes.piano ?? false,
      };
    }
    return member;
  });
};

const migrateProjects = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("[migrate] Connected, scanning projects…");

  const cursor = Project.find({ version: { $lt: 2 } }).cursor();

  for await (const project of cursor) {
    project.structure = buildSectionsFromProgression(project.chordProgression);
    project.bandSettings = {
      style: project.bandSettings?.style || project.style || "Swing",
      swingAmount:
        typeof project.swingAmount === "number"
          ? Math.min(1, Math.max(0, project.swingAmount / 100))
          : 0.6,
      members: buildMembersFromLegacy(project),
    };
    project.lickLanes =
      project.lickLanes?.length > 0
        ? project.lickLanes
        : [{ id: "lane-1", clips: [] }];
    project.version = 2;

    await project.save();
    console.log(`[migrate] ${project._id} migrated to v2`);
  }

  console.log("[migrate] Done.");
  process.exit(0);
};

migrateProjects().catch((err) => {
  console.error("[migrate] Failed:", err);
  process.exit(1);
});
