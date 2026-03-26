const mongoose = require('mongoose');

const SectionSchema = new mongoose.Schema({
  name: String,
  academicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Academic' }
});

module.exports = mongoose.model('Section', SectionSchema);