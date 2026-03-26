const mongoose = require('mongoose');

const TeacherSchema = new mongoose.Schema({
  name: String,
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }]
});

module.exports = mongoose.model('Teacher', TeacherSchema);