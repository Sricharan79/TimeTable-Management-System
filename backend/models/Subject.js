const mongoose = require('mongoose');

const SubjectSchema = new mongoose.Schema({
  name: String,
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' }
});

module.exports = mongoose.model('Subject', SubjectSchema);