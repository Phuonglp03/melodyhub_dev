import "dotenv/config";
import mongoose from "mongoose";
import Project from "../models/Project.js";
import { connectToDatabase } from "../config/db.js";
import {
  normalizeKeyPayload,
  normalizeTimeSignaturePayload,
  clampSwingAmount,
  DEFAULT_KEY,
  DEFAULT_TIME_SIGNATURE,
} from "../utils/musicTheory.js";

const hasKeyChanged = (current, normalized) => {
  if (!current) return true;
  return (
    current.root !== normalized.root ||
    current.scale !== normalized.scale ||
    current.name !== normalized.name
  );
};

const hasTimeSignatureChanged = (current, normalized) => {
  if (!current) return true;
  return (
    current.numerator !== normalized.numerator ||
    current.denominator !== normalized.denominator ||
    current.name !== normalized.name
  );
};

const migrateProjectMusicFields = async () => {
  await connectToDatabase();
  const projects = await Project.find({});
  let updatedCount = 0;

  for (const project of projects) {
    let changed = false;

    const normalizedKey = normalizeKeyPayload(project.key || DEFAULT_KEY);
    if (hasKeyChanged(project.key, normalizedKey)) {
      project.key = normalizedKey;
      changed = true;
    }

    const normalizedTimeSignature = normalizeTimeSignaturePayload(
      project.timeSignature || DEFAULT_TIME_SIGNATURE
    );
    if (
      hasTimeSignatureChanged(project.timeSignature, normalizedTimeSignature)
    ) {
      project.timeSignature = normalizedTimeSignature;
      changed = true;
    }

    const normalizedSwing = clampSwingAmount(
      project.swingAmount !== undefined ? project.swingAmount : 0
    );
    if (
      project.swingAmount === undefined ||
      project.swingAmount !== normalizedSwing
    ) {
      project.swingAmount = normalizedSwing;
      changed = true;
    }

    if (typeof project.tempo !== "number" || Number.isNaN(project.tempo)) {
      project.tempo = 120;
      changed = true;
    }

    if (changed) {
      await project.save();
      updatedCount += 1;
      console.log(`Migrated project ${project._id}`);
    }
  }

  console.log(`Migration complete. Updated ${updatedCount} project(s).`);
  await mongoose.disconnect();
};

if (import.meta.url === `file://${process.argv[1]}`) {
  migrateProjectMusicFields()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}
