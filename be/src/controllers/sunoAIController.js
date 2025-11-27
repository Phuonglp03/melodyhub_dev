import mongoose from "mongoose";
import Project from "../models/Project.js";
import ProjectTrack from "../models/ProjectTrack.js";
import ProjectTimelineItem from "../models/ProjectTimelineItem.js";
import ProjectCollaborator from "../models/ProjectCollaborator.js";

// Helper function to call Suno AI API (Official Format)
const callSunoAPI = async (prompt, duration = 30) => {
  const apiKey = process.env.SUNO_API_KEY;
  
  if (!apiKey) {
    throw new Error("SUNO_API_KEY not configured in environment");
  }

  // Call Suno AI using official API format
  const response = await fetch('https://api.sunoapi.org/api/v1/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt,
      customMode: false,
      instrumental: true,
      model: 'V3_5'
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Suno API error: ${error.msg || error.message || 'Unknown error'}`);
  }

  const result = await response.json();
  
  if (result.code !== 200) {
    throw new Error(`Suno API error: ${result.msg || 'Generation failed'}`);
  }

  return result.data; // Returns { taskId: "suno_task_abc123" }
};

// Helper to poll Suno for completion (Official Format)
const waitForSunoGeneration = async (taskId, maxAttempts = 60) => {
  const apiKey = process.env.SUNO_API_KEY;
  
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`https://api.sunoapi.org/api/v1/generate/record-info?taskId=${taskId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    
    const result = await response.json();
    
    if (result.code === 200 && result.data) {
      const { status, response: taskResponse } = result.data;
      
      if (status === 'SUCCESS' && taskResponse?.data?.[0]) {
        // Return first generated audio
        return taskResponse.data[0];
      } else if (status === 'FAILED') {
        throw new Error('Suno generation failed');
      }
      // Still processing, continue polling
    }
    
    // Wait 2 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error('Suno generation timeout');
};

// Generate AI Backing Track with Suno
export const generateAIBackingTrack = async (req, res) => {
  try {
    const { projectId } = req.params;
    const {
      chords,
      instrument,
      style,
      tempo,
      key,
      duration
    } = req.body;
    const userId = req.userId;

    // Validate inputs
    if (!chords || !Array.isArray(chords) || chords.length === 0) {
      return res.status(400).json({
        success: false,
        message: "chords array is required"
      });
    }

    // Verify project access
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found"
      });
    }

    const isOwner = project.creatorId.toString() === userId;
    const collaborator = await ProjectCollaborator.findOne({
      projectId: project._id,
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!isOwner && !collaborator) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this project"
      });
    }

    // Find or create backing track
    let backingTrack = await ProjectTrack.findOne({
      projectId: project._id,
      trackType: "backing"
    });

    if (!backingTrack) {
      backingTrack = new ProjectTrack({
        projectId: project._id,
        trackName: "AI Backing Track",
        trackOrder: 0,
        trackType: "backing",
        volume: 1.0,
        pan: 0.0,
        muted: false,
        solo: false,
      });
      await backingTrack.save();
    }

    // DELETE ALL EXISTING ITEMS ON BACKING TRACK
    await ProjectTimelineItem.deleteMany({
      trackId: backingTrack._id
    });
    console.log("Cleared existing backing track items");

    // Build intelligent prompt for Suno
    const chordNames = chords.map(c => c.chordName || c).join(', ');
    const instrumentName = instrument || "Piano";
    const musicStyle = style || "Jazz";
    const bpm = tempo || project.tempo || 120;
    const musicalKey = key || project.key || "C Major";

    const prompt = `${instrumentName} backing track playing ${chordNames} in ${musicalKey} at ${bpm}BPM. ${musicStyle} style. Clean instrumental chords only, no melody, no vocals. Professional studio quality.`;

    console.log("Generating AI backing track with prompt:", prompt);

    // Call Suno AI API (using official format)
    const generationResponse = await callSunoAPI(prompt, duration || 30);
    
    if (!generationResponse || !generationResponse.taskId) {
      throw new Error("Failed to start Suno generation");
    }

    console.log("Suno generation started. Task ID:", generationResponse.taskId);

    // Poll for completion
    const audioData = await waitForSunoGeneration(generationResponse.taskId);
    
    if (!audioData || !audioData.audio_url ) {
      throw new Error("No audio URL returned from Suno");
    }

    console.log("Suno generation complete:", audioData.audio_url);

    // Create NEW timeline item with the generated audio
    const timelineItem = new ProjectTimelineItem({
      trackId: backingTrack._id,
      userId,
      startTime: 0, // Place at beginning
      duration: audioData.duration || duration || 30,
      offset: 0,
      type: "lick", // Store as audio lick
      sourceDuration: audioData.duration || duration || 30,
      loopEnabled: false,
      playbackRate: 1,
    });

    await timelineItem.save();

    res.status(201).json({
      success: true,
      message: "AI backing track generated successfully! 🎵",
      data: {
        timelineItem,
        audio_url: audioData.audio_url,
        duration: audioData.duration,
        replacedItems: true
      }
    });

  } catch (error) {
    console.error("Error generating AI backing track:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate AI backing track",
      error: error.message
    });
  }
};
