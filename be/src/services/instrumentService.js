import Instrument from "../models/Instrument.js";
import DEFAULT_INSTRUMENTS from "../data/defaultInstruments.js";

/**
 * Ensure default instruments are seeded in the database
 * @returns {Promise<Array>} Array of instruments
 */
export const ensureInstrumentsSeeded = async () => {
  try {
    // Check if instruments exist
    let instruments = await Instrument.find().sort({ name: 1 });

    if (instruments.length === 0) {
      // Seed default instruments
      console.log("No instruments found, seeding default instruments...");
      try {
        // Validate DEFAULT_INSTRUMENTS is loaded correctly
        if (!DEFAULT_INSTRUMENTS) {
          throw new Error("DEFAULT_INSTRUMENTS is undefined");
        }
        
        if (!Array.isArray(DEFAULT_INSTRUMENTS)) {
          throw new Error(`DEFAULT_INSTRUMENTS is not an array, got: ${typeof DEFAULT_INSTRUMENTS}`);
        }
        
        if (DEFAULT_INSTRUMENTS.length === 0) {
          throw new Error("DEFAULT_INSTRUMENTS array is empty");
        }

        console.log(`Attempting to seed ${DEFAULT_INSTRUMENTS.length} instruments...`);
        const insertedInstruments = await Instrument.insertMany(
          DEFAULT_INSTRUMENTS,
          { ordered: false } // Continue even if some duplicates exist
        );
        instruments = insertedInstruments;
        console.log(`Successfully seeded ${insertedInstruments.length} instruments`);
      } catch (seedError) {
        // If seeding fails (e.g., duplicates), just fetch what exists
        console.error("Error seeding instruments:", seedError);
        console.error("Seed error details:", {
          message: seedError.message,
          stack: seedError.stack,
          name: seedError.name,
          code: seedError.code,
        });
        // Try to fetch what exists anyway
        instruments = await Instrument.find().sort({ name: 1 });
      }
    }

    return instruments;
  } catch (error) {
    console.error("Error in ensureInstrumentsSeeded:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Get all available instruments
 * @returns {Promise<Array>} Array of instruments
 */
export const getAllInstruments = async () => {
  try {
    // Ensure instruments are seeded first
    const instruments = await ensureInstrumentsSeeded();
    
    // Return empty array if no instruments found (should not happen after seeding)
    if (!instruments || instruments.length === 0) {
      console.warn("No instruments found after seeding attempt");
      return [];
    }
    
    return instruments;
  } catch (error) {
    console.error("Error getting instruments:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    throw error;
  }
};

/**
 * Get instrument by ID
 * @param {string} instrumentId - Instrument ID
 * @returns {Promise<Object|null>} Instrument object or null
 */
export const getInstrumentById = async (instrumentId) => {
  try {
    if (!instrumentId) return null;
    const instrument = await Instrument.findById(instrumentId);
    return instrument;
  } catch (error) {
    console.error("Error getting instrument by ID:", error);
    return null;
  }
};

