const express = require('express');
const router = express.Router();

const Subject = require('../models/Subject');
const Teacher = require('../models/Teacher');
const Timetable = require('../models/Timetable');

const generateTimetable = require('../utils/generateTimetable');

router.post('/generate', async (req, res) => {
  const { departmentId, courseId, sectionId } = req.body;

  try {
    const subjects = await Subject.find({ courseId });

    const teachers = await Teacher.find({ departmentId });

    const entries = generateTimetable(subjects, teachers);

    const timetable = await Timetable.create({
      sectionId,
      entries
    });

    res.json(timetable);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;