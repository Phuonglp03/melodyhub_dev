import mongoose from 'mongoose';

const projectTimelineItemSchema = new mongoose.Schema(
  {
    trackId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectTrack', required: true },
    lickId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lick' },
    backingTrackId: { type: mongoose.Schema.Types.ObjectId, ref: 'BackingTrack' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startTime: { type: Number, required: true },
    duration: { type: Number, required: true },
  },
  { timestamps: false }
);

const ProjectTimelineItem = mongoose.model('ProjectTimelineItem', projectTimelineItemSchema);
export default ProjectTimelineItem;


