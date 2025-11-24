import "dotenv/config";
import Instrument from "../models/Instrument.js";
import DEFAULT_INSTRUMENTS from "../data/defaultInstruments.js";
import { connectToDatabase } from "../config/db.js";

const seedInstruments = async () => {
  try {
    // Connect to database
    await connectToDatabase();
    console.log("Connected to database");

    // Check existing instruments
    const existingCount = await Instrument.countDocuments();
    console.log(`Found ${existingCount} existing instruments`);

    if (existingCount > 0) {
      console.log("Instruments already exist. Skipping seed.");
      console.log("To re-seed, please clear the instruments collection first.");
      process.exit(0);
    }

    // Insert default instruments
    console.log("Inserting default instruments...");
    const result = await Instrument.insertMany(DEFAULT_INSTRUMENTS, {
      ordered: false, // Continue even if some duplicates exist
    });
    console.log(`\n✅ Successfully seeded ${result.length} instruments:\n`);
    result.forEach((inst) => {
      console.log(`  ✓ ${inst.name} (${inst.soundfontKey})`);
    });
    console.log("\n✨ Seed completed successfully!");

    process.exit(0);
  } catch (error) {
    console.error("Error seeding instruments:", error);
    process.exit(1);
  }
};

// Run if called directly
seedInstruments();

export default seedInstruments;

