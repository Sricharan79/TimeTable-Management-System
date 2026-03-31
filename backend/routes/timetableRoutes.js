const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Subject = require('../models/Subject');
const Teacher = require('../models/Teacher');
const Timetable = require('../models/Timetable');
const SwapRequest = require('../models/SwapRequest');

const generateTimetable = require('../utils/generateTimetable');

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
const normalizeTeacherName = (name) => String(name || '').trim().toLowerCase();

router.post('/generate', async (req, res) => {
  const { departmentId, courseId, sectionId } = req.body;

  try {
    const subjects = await Subject.find({ courseId });

    const teachers = await Teacher.find({ departmentId });

    // Build existingTeacherSchedule across ALL departments to prevent cross-department conflicts
    const existingTeacherSchedule = new Set();
    const existingTeacherScheduleByName = new Set();
    
    // Get all other timetables to check global teacher conflicts.
    const allTimetablesRaw = await Timetable.find({ sectionId: { $ne: sectionId } })
      .populate('entries.subjectId', 'name')
      .populate('entries.teacherId', '_id name')
      .sort({ createdAt: -1 });

    const latestTimetableBySection = new Map();
    for (const timetable of allTimetablesRaw) {
      const key = String(timetable.sectionId || '');
      if (!latestTimetableBySection.has(key)) {
        latestTimetableBySection.set(key, timetable);
      }
    }
    const allTimetables = Array.from(latestTimetableBySection.values());

    for (const timetable of allTimetables) {
      for (const entry of timetable.entries) {
        if (!entry?.teacherId || !entry?.subjectId) continue;
        const teacherId = entry.teacherId._id.toString();
        if (entry.day && entry.period) {
          existingTeacherSchedule.add(`${teacherId}-${entry.day}-${entry.period}`);
          const teacherNameKey = normalizeTeacherName(entry.teacherId.name);
          if (teacherNameKey) {
            existingTeacherScheduleByName.add(`${teacherNameKey}-${entry.day}-${entry.period}`);
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
      freeSlotsPerDay: 1,
      existingTeacherSchedule,
      existingTeacherScheduleByName
    });

    const timetable = await Timetable.findOneAndUpdate(
      { sectionId },
      { sectionId, entries },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

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
    const displaySlots = DISPLAY_SLOTS;

    const entryMap = new Map();
    for (const entry of timetable.entries) {
      entryMap.set(`${entry.day}-${entry.period}`, entry);
    }

    const escapeHtml = (value) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const timetableHeaderCells = displaySlots
      .map((slot) => {
        const label = escapeHtml(slot.label || `P${slot.period}`);
        const time = escapeHtml(`${slot.start} - ${slot.end}`);
        return `<th><div>${label}</div><small>${time}</small></th>`;
      })
      .join('');

    const timetableBodyRows = days
      .map((day) => {
        const cells = displaySlots
          .map((slot) => {
            if (slot.isBreak) {
              return '<td>Lunch</td>';
            }

            const entry = entryMap.get(`${day}-${slot.period}`);
            const subjectName = entry?.subjectId?.name || 'Free Slot';
            return `<td>${escapeHtml(subjectName)}</td>`;
          })
          .join('');

        return `<tr><td><b>${escapeHtml(day)}</b></td>${cells}</tr>`;
      })
      .join('');

    const pairMap = new Map();
    for (const day of days) {
      for (const slot of displaySlots) {
        if (slot.isBreak || !slot.period) continue;
        const entry = entryMap.get(`${day}-${slot.period}`);
        const subjectName = entry?.subjectId?.name;
        const teacherName = entry?.teacherId?.name;
        if (!subjectName || !teacherName) continue;

        const key = `${subjectName}__${teacherName}`;
        if (!pairMap.has(key)) {
          pairMap.set(key, { subjectName, teacherName });
        }
      }
    }

    const allocationRows = Array.from(pairMap.values())
      .map((item) => `<tr><td>${escapeHtml(item.subjectName)}</td><td>${escapeHtml(item.teacherName)}</td></tr>`)
      .join('');

    const sectionLabel = timetable.sectionId?.name || 'N/A';
    const htmlDoc = `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      body { font-family: Calibri, Arial, sans-serif; color: #111; }
      h1, h2 { margin: 0 0 8px 0; }
      p { margin: 0 0 12px 0; }
      table { border-collapse: collapse; width: 100%; margin: 10px 0 20px 0; }
      th, td { border: 1px solid #8b8b8b; padding: 6px; font-size: 12px; text-align: center; vertical-align: middle; }
      th { background: #f0f4f8; }
      small { display: block; color: #444; font-size: 10px; margin-top: 2px; }
      .meta { margin-bottom: 14px; }
      .left { text-align: left; }
    </style>
  </head>
  <body>
    <h1>Timetable Generator</h1>
    <p class="meta"><b>Section:</b> ${escapeHtml(sectionLabel)}</p>

    <table>
      <thead>
        <tr>
          <th>Day</th>
          ${timetableHeaderCells}
        </tr>
      </thead>
      <tbody>
        ${timetableBodyRows}
      </tbody>
    </table>

    <h2>Course - Teacher Allocation</h2>
    <table>
      <thead>
        <tr>
          <th class="left">Course</th>
          <th class="left">Teacher</th>
        </tr>
      </thead>
      <tbody>
        ${allocationRows || '<tr><td colspan="2">No allocation data available</td></tr>'}
      </tbody>
    </table>
  </body>
</html>`;

    const buffer = Buffer.from(htmlDoc, 'utf8');
    const sectionName = timetable.sectionId?.name ? `-${timetable.sectionId.name}` : '';
    const filename = `timetable${sectionName}.doc`;

    res.setHeader('Content-Type', 'application/msword; charset=utf-8');
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

router.get('/section/:sectionId/all', async (req, res) => {
  const { sectionId } = req.params;
  if (!isValidId(sectionId)) {
    return res.status(400).json({ error: 'Invalid sectionId' });
  }

  try {
    const timetables = await Timetable.find({ sectionId })
      .populate('sectionId', 'name')
      .sort({ createdAt: -1 });

    const list = timetables.map((item) => {
      const totalSlots = Array.isArray(item.entries) ? item.entries.length : 0;
      const assignedSlots = Array.isArray(item.entries)
        ? item.entries.filter((entry) => entry?.subjectId && entry?.teacherId).length
        : 0;

      return {
        _id: item._id,
        sectionId: item.sectionId?._id || sectionId,
        sectionName: item.sectionId?.name || 'Unknown section',
        createdAt: item.createdAt,
        totalSlots,
        assignedSlots
      };
    });

    return res.json(list);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:timetableId', async (req, res) => {
  const { timetableId } = req.params;
  if (!isValidId(timetableId)) {
    return res.status(400).json({ error: 'Invalid timetableId' });
  }

  try {
    const deleted = await Timetable.findByIdAndDelete(timetableId);

    if (!deleted) {
      return res.status(404).json({ error: 'Timetable not found' });
    }

    await SwapRequest.deleteMany({ timetableId });

    return res.json({ message: 'Timetable deleted successfully' });
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