const mongoose = require('mongoose');

const AcademicSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  year: Number,
  semester: Number
});

module.exports = mongoose.model('Academic', AcademicSchema);