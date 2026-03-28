const express = require('express');
const router = express.Router();

const Subject = require('../models/Subject');
const Teacher = require('../models/Teacher');
const Timetable = require('../models/Timetable');
const Academic = require('../models/Academic');
const Section = require('../models/Section');
const Course = require('../models/Course');

const generateTimetable = require('../utils/generateTimetable');
const xlsx = require('xlsx');

router.post('/generate', async (req, res) => {
  const { departmentId, courseId, sectionId } = req.body;

  try {
    const subjects = await Subject.find({ courseId });

    const teachers = await Teacher.find({ departmentId });

    const departmentCourses = await Course.find({ departmentId }).select('_id');
    const departmentCourseIds = departmentCourses.map((course) => course._id);
    const departmentAcademics = await Academic.find({ courseId: { $in: departmentCourseIds } }).select('_id');
    const departmentAcademicIds = departmentAcademics.map((academic) => academic._id);
    const departmentSections = await Section.find({ academicId: { $in: departmentAcademicIds } }).select('_id');
    const otherSectionIds = departmentSections
      .map((section) => section._id)
      .filter((id) => id.toString() !== String(sectionId));

    const existingTeacherSchedule = new Set();
    if (otherSectionIds.length) {
      const otherTimetables = await Timetable.find({ sectionId: { $in: otherSectionIds } })
        .populate('entries.subjectId', 'name')
        .populate('entries.teacherId', '_id');

      for (const timetable of otherTimetables) {
        for (const entry of timetable.entries) {
          if (!entry?.teacherId || !entry?.subjectId) continue;
          const teacherId = entry.teacherId._id.toString();
          if (entry.day && entry.period) {
            existingTeacherSchedule.add(`${teacherId}-${entry.day}-${entry.period}`);
          }
        }
      }
    }

    const teachingSlots = [
      { period: 1, start: '09:30', end: '10:20' },
      { period: 2, start: '10:20', end: '11:10' },
      { period: 3, start: '11:10', end: '12:00' },
      { period: 4, start: '12:00', end: '12:50' },
      { period: 5, start: '13:20', end: '14:10' },
      { period: 6, start: '14:10', end: '15:00' },
      { period: 7, start: '15:00', end: '15:50' },
      { period: 8, start: '15:50', end: '16:40' }
    ];

    const displaySlots = [
      { period: 1, label: 'P1', start: '09:30', end: '10:20' },
      { period: 2, label: 'P2', start: '10:20', end: '11:10' },
      { period: 3, label: 'P3', start: '11:10', end: '12:00' },
      { period: 4, label: 'P4', start: '12:00', end: '12:50' },
      { label: 'Lunch', start: '12:50', end: '13:20', isBreak: true },
      { period: 5, label: 'P5', start: '13:20', end: '14:10' },
      { period: 6, label: 'P6', start: '14:10', end: '15:00' },
      { period: 7, label: 'P7', start: '15:00', end: '15:50' },
      { period: 8, label: 'P8', start: '15:50', end: '16:40' }
    ];

    const { entries, remainingBySubject } = generateTimetable(subjects, teachers, {
      timeSlots: teachingSlots,
      maxClassesPerSubjectPerDay: 2,
      classesPerSubjectPerWeek: 6,
      maxSubjectsPerTeacher: 4,
      maxSubjectsPerTeacherPerSection: 1,
      existingTeacherSchedule
    });

    const timetable = await Timetable.create({
      sectionId,
      entries
    });

    res.json({
      timetable,
      displaySlots,
      remainingBySubject
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/download/:id', async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id)
      .populate('entries.subjectId')
      .populate('entries.teacherId')
      .populate('sectionId');

    if (!timetable) {
      return res.status(404).json({ error: 'Timetable not found' });
    }

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const displaySlots = [
      { period: 1, label: 'P1', start: '09:30', end: '10:20' },
      { period: 2, label: 'P2', start: '10:20', end: '11:10' },
      { period: 3, label: 'P3', start: '11:10', end: '12:00' },
      { period: 4, label: 'P4', start: '12:00', end: '12:50' },
      { label: 'Lunch', start: '12:50', end: '13:40', isBreak: true },
      { period: 5, label: 'P5', start: '13:40', end: '14:30' },
      { period: 6, label: 'P6', start: '14:30', end: '15:20' },
      { period: 7, label: 'P7', start: '15:20', end: '16:10' }
    ];

    const entryMap = new Map();
    for (const entry of timetable.entries) {
      entryMap.set(`${entry.day}-${entry.period}`, entry);
    }

    const rows = [];
    for (const day of days) {
      for (const slot of displaySlots) {
        if (slot.isBreak) {
          rows.push({
            Day: day,
            Period: slot.label,
            Time: `${slot.start} - ${slot.end}`,
            Subject: 'Lunch',
            Teacher: ''
          });
          continue;
        }

        const entry = entryMap.get(`${day}-${slot.period}`);
        rows.push({
          Day: day,
          Period: slot.label,
          Time: `${slot.start} - ${slot.end}`,
          Subject: entry?.subjectId?.name || '',
          Teacher: entry?.teacherId?.name || ''
        });
      }
    }

    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(rows);
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Timetable');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const sectionName = timetable.sectionId?.name ? `-${timetable.sectionId.name}` : '';
    const filename = `timetable${sectionName}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;