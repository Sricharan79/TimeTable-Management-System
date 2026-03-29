const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Subject = require('../models/Subject');
const Teacher = require('../models/Teacher');
const Timetable = require('../models/Timetable');
const Academic = require('../models/Academic');
const Section = require('../models/Section');
const Course = require('../models/Course');
const SwapRequest = require('../models/SwapRequest');

const generateTimetable = require('../utils/generateTimetable');
const xlsx = require('xlsx');

const DISPLAY_SLOTS = [
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

const getSlotLabel = (period) => DISPLAY_SLOTS.find((slot) => slot.period === period)?.label || `P${period}`;

const isValidId = (value) => mongoose.Types.ObjectId.isValid(String(value || ''));

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

router.get('/faculty/teachers', async (req, res) => {
  try {
    const teachers = await Teacher.find()
      .populate('departmentId', 'name')
      .sort({ name: 1 });

    return res.json(teachers);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/faculty/:teacherId/timetable', async (req, res) => {
  const { teacherId } = req.params;
  if (!isValidId(teacherId)) {
    return res.status(400).json({ error: 'Invalid teacherId' });
  }

  try {
    const timetables = await Timetable.find({ 'entries.teacherId': teacherId })
      .populate('sectionId', 'name academicId')
      .populate('entries.subjectId', 'name')
      .populate('entries.teacherId', 'name')
      .sort({ createdAt: -1 });

    const entries = [];
    for (const timetable of timetables) {
      for (const entry of timetable.entries) {
        if (!entry.teacherId || String(entry.teacherId._id) !== String(teacherId)) continue;

        entries.push({
          timetableId: timetable._id,
          sectionId: timetable.sectionId?._id,
          sectionName: timetable.sectionId?.name || 'Unknown section',
          day: entry.day,
          period: entry.period,
          periodLabel: getSlotLabel(entry.period),
          time: entry.time,
          subjectId: entry.subjectId?._id,
          subjectName: entry.subjectId?.name || 'Unknown subject'
        });
      }
    }

    return res.json({
      teacherId,
      entries,
      displaySlots: DISPLAY_SLOTS
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/section/:sectionId/latest', async (req, res) => {
  const { sectionId } = req.params;
  if (!isValidId(sectionId)) {
    return res.status(400).json({ error: 'Invalid sectionId' });
  }

  try {
    const timetable = await Timetable.findOne({ sectionId })
      .populate('entries.subjectId', 'name')
      .populate('entries.teacherId', 'name')
      .sort({ createdAt: -1 });

    if (!timetable) {
      return res.status(404).json({ error: 'Timetable not found for this section' });
    }

    return res.json({ timetable, displaySlots: DISPLAY_SLOTS });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/swap-request', async (req, res) => {
  const { fromTeacherId, toTeacherId, sectionId, day, period, reason = '' } = req.body;

  if (!isValidId(fromTeacherId) || !isValidId(toTeacherId) || !isValidId(sectionId) || !day || !period) {
    return res.status(400).json({ error: 'fromTeacherId, toTeacherId, sectionId, day and period are required' });
  }

  if (String(fromTeacherId) === String(toTeacherId)) {
    return res.status(400).json({ error: 'Swap target should be a different faculty member' });
  }

  try {
    const sourceTimetable = await Timetable.findOne({
      sectionId,
      entries: {
        $elemMatch: {
          day,
          period: Number(period),
          teacherId: fromTeacherId
        }
      }
    })
      .populate('entries.subjectId', 'name')
      .sort({ createdAt: -1 });

    if (!sourceTimetable) {
      return res.status(404).json({ error: 'No matching faculty class found for swap request' });
    }

    const sourceEntry = sourceTimetable.entries.find(
      (entry) =>
        entry.day === day &&
        Number(entry.period) === Number(period) &&
        String(entry.teacherId) === String(fromTeacherId)
    );

    if (!sourceEntry) {
      return res.status(404).json({ error: 'No matching timetable entry found' });
    }

    const toTeacherBusy = await Timetable.exists({
      entries: {
        $elemMatch: {
          day,
          period: Number(period),
          teacherId: toTeacherId
        }
      }
    });

    if (toTeacherBusy) {
      return res.status(400).json({ error: 'Selected faculty member is already busy in that slot' });
    }

    const duplicatePending = await SwapRequest.findOne({
      fromTeacherId,
      toTeacherId,
      sectionId,
      day,
      period: Number(period),
      status: 'pending'
    });

    if (duplicatePending) {
      return res.status(400).json({ error: 'A pending request for this slot already exists' });
    }

    const swapRequest = await SwapRequest.create({
      timetableId: sourceTimetable._id,
      sectionId,
      subjectId: sourceEntry.subjectId?._id || sourceEntry.subjectId,
      fromTeacherId,
      toTeacherId,
      day,
      period: Number(period),
      reason: String(reason || '').trim()
    });

    const populated = await SwapRequest.findById(swapRequest._id)
      .populate('fromTeacherId', 'name')
      .populate('toTeacherId', 'name')
      .populate('sectionId', 'name')
      .populate('subjectId', 'name');

    return res.status(201).json({
      message: 'Swap request sent. Notification created for selected faculty.',
      request: populated
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/notifications/:teacherId', async (req, res) => {
  const { teacherId } = req.params;
  if (!isValidId(teacherId)) {
    return res.status(400).json({ error: 'Invalid teacherId' });
  }

  try {
    const incoming = await SwapRequest.find({ toTeacherId: teacherId })
      .populate('fromTeacherId', 'name')
      .populate('toTeacherId', 'name')
      .populate('sectionId', 'name')
      .populate('subjectId', 'name')
      .sort({ createdAt: -1 });

    const outgoing = await SwapRequest.find({ fromTeacherId: teacherId })
      .populate('fromTeacherId', 'name')
      .populate('toTeacherId', 'name')
      .populate('sectionId', 'name')
      .populate('subjectId', 'name')
      .sort({ createdAt: -1 });

    return res.json({ incoming, outgoing });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/swap-request/:requestId/respond', async (req, res) => {
  const { requestId } = req.params;
  const { status, responseNote = '' } = req.body;

  if (!isValidId(requestId)) {
    return res.status(400).json({ error: 'Invalid requestId' });
  }

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'status must be approved or rejected' });
  }

  try {
    const swapRequest = await SwapRequest.findById(requestId);
    if (!swapRequest) {
      return res.status(404).json({ error: 'Swap request not found' });
    }

    if (swapRequest.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending requests can be updated' });
    }

    if (status === 'approved') {
      const toTeacherBusy = await Timetable.exists({
        _id: { $ne: swapRequest.timetableId },
        entries: {
          $elemMatch: {
            day: swapRequest.day,
            period: swapRequest.period,
            teacherId: swapRequest.toTeacherId
          }
        }
      });

      if (toTeacherBusy) {
        return res.status(400).json({ error: 'Target faculty is busy in another section for this slot' });
      }

      await Timetable.updateOne(
        {
          _id: swapRequest.timetableId,
          entries: {
            $elemMatch: {
              day: swapRequest.day,
              period: swapRequest.period,
              teacherId: swapRequest.fromTeacherId,
              subjectId: swapRequest.subjectId
            }
          }
        },
        {
          $set: {
            'entries.$.teacherId': swapRequest.toTeacherId
          }
        }
      );
    }

    swapRequest.status = status;
    swapRequest.responseNote = String(responseNote || '').trim();
    await swapRequest.save();

    const populated = await SwapRequest.findById(swapRequest._id)
      .populate('fromTeacherId', 'name')
      .populate('toTeacherId', 'name')
      .populate('sectionId', 'name')
      .populate('subjectId', 'name');

    return res.json({
      message: status === 'approved' ? 'Swap approved and timetable updated.' : 'Swap request rejected.',
      request: populated
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;