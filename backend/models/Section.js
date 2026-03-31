const mongoose = require('mongoose');

const SectionSchema = new mongoose.Schema({
  name: String,
  academicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Academic' },
  fixedSlots: [
    {
      day: String,
      period: Number,
      label: { type: String, default: '' }
    }
  ]
});

module.exports = mongoose.model('Section', SectionSchema);