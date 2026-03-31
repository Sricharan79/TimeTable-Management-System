const mongoose = require('mongoose');

const SwapRequestSchema = new mongoose.Schema(
  {
    timetableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Timetable', required: true },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    fromTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
    toTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
    day: { type: String, required: true },
    period: { type: Number, required: true },
    reason: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    responseNote: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('SwapRequest', SwapRequestSchema);
