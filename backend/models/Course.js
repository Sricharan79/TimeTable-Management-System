const mongoose = require('mongoose');

const CourseSchema = new mongoose.Schema({
  name: String,
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' }
});

module.exports = mongoose.model('Course', CourseSchema);