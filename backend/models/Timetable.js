const mongoose = require('mongoose');

const TimetableSchema = new mongoose.Schema({
  sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
  entries: [
    {
      day: String,
      period: Number,
      subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
      teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' }
    }
  ]
});

module.exports = mongoose.model('Timetable', TimetableSchema);