const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const xlsx = require('xlsx');
const mammoth = require('mammoth');

const Department = require('../models/Department');
const Course = require('../models/Course');
const Academic = require('../models/Academic');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const Teacher = require('../models/Teacher');
const Timetable = require('../models/Timetable');

const upload = multer({ storage: multer.memoryStorage() });

const normalizeText = (value) => String(value ?? '').trim();
const isValidId = (value) => mongoose.Types.ObjectId.isValid(String(value || ''));

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findDepartmentByNameInsensitive = async (name) => {
  const normalized = normalizeText(name);
  if (!normalized) return null;

  return Department.findOne({
    name: { $regex: `^${escapeRegExp(normalized)}$`, $options: 'i' }
  });
};

const findCourseByNameInsensitive = async (name, departmentId) => {
  const normalized = normalizeText(name);
  if (!normalized || !departmentId) return null;

  return Course.findOne({
    departmentId,
    name: { $regex: `^${escapeRegExp(normalized)}$`, $options: 'i' }
  });
};

const findSectionByNameInsensitive = async (name, academicId) => {
  const normalized = normalizeText(name);
  if (!normalized || !academicId) return null;

  return Section.findOne({
    academicId,
    name: { $regex: `^${escapeRegExp(normalized)}$`, $options: 'i' }
  });
};

const findAcademicDuplicate = async (courseId, year, semester) => {
  if (!courseId || year === null || year === undefined || semester === null || semester === undefined) {
    return null;
  }

  return Academic.findOne({ courseId, year, semester });
};

const parseRawTextToRows = (rawText) => {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const separator = lines[0].includes('\t')
    ? '\t'
    : lines[0].includes('|')
      ? '|'
      : ',';

  const headers = lines[0]
    .split(separator)
    .map((header) => normalizeText(header).toLowerCase());

  return lines.slice(1).map((line) => {
    const values = line.split(separator).map((value) => normalizeText(value));
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });

    return row;
  });
};

const parseUploadRows = async (file) => {
  const extension = (file.originalname.split('.').pop() || '').toLowerCase();

  if (['xlsx', 'xls', 'csv'].includes(extension)) {
    const workbook = xlsx.read(file.buffer, { type: 'buffer' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

    return xlsx.utils.sheet_to_json(firstSheet, {
      defval: '',
      raw: false
    });
  }

  if (extension === 'docx') {
    const { value } = await mammoth.extractRawText({ buffer: file.buffer });
    return parseRawTextToRows(value);
  }

  throw new Error('Unsupported file format. Please upload .xlsx, .xls, .csv, or .docx');
};

const getCaseInsensitive = (row, key) => {
  const matchedKey = Object.keys(row).find(
    (rowKey) => normalizeText(rowKey).toLowerCase() === key.toLowerCase()
  );

  return matchedKey ? row[matchedKey] : '';
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const importRowsByEntity = async (entity, rows, context = {}) => {
  const { departmentId, courseId, academicId } = context;
  const imported = [];
  const skipped = [];

  for (const row of rows) {
    try {
      if (entity === 'department') {
        const name = normalizeText(getCaseInsensitive(row, 'name'));
        if (!name) throw new Error('name is required');

        const existingDepartment = await findDepartmentByNameInsensitive(name);
        if (existingDepartment) {
          throw new Error('department already exists');
        }

        const created = await Department.create({ name });
        imported.push(created);
      } else if (entity === 'course') {
        const name = normalizeText(getCaseInsensitive(row, 'name'));
        const currentDepartmentId = normalizeText(getCaseInsensitive(row, 'departmentId')) || departmentId;
        if (!name || !currentDepartmentId) throw new Error('name and departmentId are required');

        const existingCourse = await findCourseByNameInsensitive(name, currentDepartmentId);
        if (existingCourse) {
          throw new Error('program already exists for this department');
        }

        const created = await Course.create({
          name,
          departmentId: currentDepartmentId
        });
        imported.push(created);
      } else if (entity === 'academic') {
        const year = toNumber(getCaseInsensitive(row, 'year'));
        const semester = toNumber(getCaseInsensitive(row, 'semester'));
        const currentCourseId = normalizeText(getCaseInsensitive(row, 'courseId')) || courseId;
        if (!currentCourseId || year === null || semester === null) {
          throw new Error('courseId, year and semester are required');
        }

        const existingAcademic = await findAcademicDuplicate(currentCourseId, year, semester);
        if (existingAcademic) {
          throw new Error('year/term already exists for this program');
        }

        const created = await Academic.create({
          courseId: currentCourseId,
          year,
          semester
        });
        imported.push(created);
      } else if (entity === 'section') {
        const name = normalizeText(getCaseInsensitive(row, 'name'));
        const currentAcademicId = normalizeText(getCaseInsensitive(row, 'academicId')) || academicId;
        if (!name || !currentAcademicId) throw new Error('name and academicId are required');

        const existingSection = await findSectionByNameInsensitive(name, currentAcademicId);
        if (existingSection) {
          throw new Error('section already exists for this year/term');
        }

        const created = await Section.create({
          name,
          academicId: currentAcademicId
        });
        imported.push(created);
      } else if (entity === 'subject') {
        const name = normalizeText(getCaseInsensitive(row, 'name'));
        const currentCourseId = normalizeText(getCaseInsensitive(row, 'courseId')) || courseId;
        if (!name || !currentCourseId) throw new Error('name and courseId are required');

        const created = await Subject.create({
          name,
          courseId: currentCourseId
        });
        imported.push(created);
      } else if (entity === 'teacher') {
        const name = normalizeText(getCaseInsensitive(row, 'name'));
        const currentDepartmentId = normalizeText(getCaseInsensitive(row, 'departmentId')) || departmentId;
        const subjectsCell = normalizeText(getCaseInsensitive(row, 'subjects'));

        if (!name || !currentDepartmentId) throw new Error('name and departmentId are required');

        let subjectIds = [];
        if (subjectsCell) {
          const subjectNames = subjectsCell
            .split(',')
            .map((value) => normalizeText(value))
            .filter(Boolean);

          if (subjectNames.length) {
            const subjectDocs = await Subject.find({ name: { $in: subjectNames } });
            subjectIds = subjectDocs.map((subject) => subject._id);
          }
        }

        const created = await Teacher.create({
          name,
          departmentId: currentDepartmentId,
          subjects: subjectIds
        });
        imported.push(created);
      } else {
        throw new Error('Unsupported entity type');
      }
    } catch (rowError) {
      skipped.push({ row, reason: rowError.message });
    }
  }

  return { imported, skipped };
};

// Upload and import data from Excel/Word
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { entity, departmentId, courseId, academicId } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'file is required' });
    }

    const effectiveEntity = normalizeText(entity || 'mixed').toLowerCase();

    if (!['mixed', 'department', 'course', 'academic', 'section', 'subject', 'teacher'].includes(effectiveEntity)) {
      return res.status(400).json({ error: 'Unsupported entity. Use mixed, department, course, academic, section, subject, or teacher' });
    }

    if (effectiveEntity === 'mixed') {
      const extension = (req.file.originalname.split('.').pop() || '').toLowerCase();
      if (!['xlsx', 'xls'].includes(extension)) {
        return res.status(400).json({ error: 'Mixed upload supports Excel files only (.xlsx or .xls)' });
      }

      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheetToEntity = {
        department: 'department',
        departments: 'department',
        course: 'course',
        courses: 'course',
        academic: 'academic',
        academics: 'academic',
        section: 'section',
        sections: 'section',
        subject: 'subject',
        subjects: 'subject',
        teacher: 'teacher',
        teachers: 'teacher'
      };

      let importedCount = 0;
      let skippedCount = 0;
      const skipped = [];
      const importedByEntity = {};
      let processedBySheets = false;

      for (const sheetName of workbook.SheetNames) {
        const key = normalizeText(sheetName).toLowerCase();
        const mappedEntity = sheetToEntity[key];
        if (!mappedEntity) continue;

        processedBySheets = true;
        const sheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(sheet, { defval: '', raw: false });
        if (!rows.length) continue;

        const result = await importRowsByEntity(mappedEntity, rows, { departmentId, courseId, academicId });
        importedCount += result.imported.length;
        skippedCount += result.skipped.length;
        skipped.push(...result.skipped.map((item) => ({ ...item, entity: mappedEntity })));
        importedByEntity[mappedEntity] = (importedByEntity[mappedEntity] || 0) + result.imported.length;
      }

      if (!processedBySheets) {
        const rows = await parseUploadRows(req.file);

        if (!rows.length) {
          return res.status(400).json({ error: 'No rows found in uploaded file' });
        }

        const groupedRows = {
          department: [],
          course: [],
          academic: [],
          section: [],
          subject: [],
          teacher: []
        };

        for (const row of rows) {
          const rowEntity = normalizeText(getCaseInsensitive(row, 'entity')).toLowerCase();
          if (groupedRows[rowEntity]) {
            groupedRows[rowEntity].push(row);
          } else {
            skipped.push({ row, reason: 'entity column missing/invalid for mixed upload', entity: 'unknown' });
            skippedCount += 1;
          }
        }

        for (const currentEntity of Object.keys(groupedRows)) {
          const entityRows = groupedRows[currentEntity];
          if (!entityRows.length) continue;

          const result = await importRowsByEntity(currentEntity, entityRows, { departmentId, courseId, academicId });
          importedCount += result.imported.length;
          skippedCount += result.skipped.length;
          skipped.push(...result.skipped.map((item) => ({ ...item, entity: currentEntity })));
          importedByEntity[currentEntity] = (importedByEntity[currentEntity] || 0) + result.imported.length;
        }
      }

      return res.json({
        message: 'Mixed upload processed',
        entity: 'mixed',
        importedCount,
        skippedCount,
        importedByEntity,
        skipped
      });
    }

    const rows = await parseUploadRows(req.file);

    if (!rows.length) {
      return res.status(400).json({ error: 'No rows found in uploaded file' });
    }

    const { imported, skipped } = await importRowsByEntity(effectiveEntity, rows, {
      departmentId,
      courseId,
      academicId
    });

    return res.json({
      message: 'Upload processed',
      entity: effectiveEntity,
      importedCount: imported.length,
      skippedCount: skipped.length,
      skipped
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});


// =====================
// ✅ POST ROUTES
// =====================

// Add Department
router.post('/department', async (req, res) => {
  try {
    const name = normalizeText(req.body?.name);

    if (!name) {
      return res.status(400).json({ error: 'Department name is required' });
    }

    const existingDepartment = await findDepartmentByNameInsensitive(name);
    if (existingDepartment) {
      return res.status(409).json({ error: 'Department already exists' });
    }

    const data = await Department.create({ ...req.body, name });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Course
router.post('/course', async (req, res) => {
  try {
    const name = normalizeText(req.body?.name);
    const departmentId = req.body?.departmentId;

    if (!name || !departmentId) {
      return res.status(400).json({ error: 'name and departmentId are required' });
    }

    const existingCourse = await findCourseByNameInsensitive(name, departmentId);
    if (existingCourse) {
      return res.status(409).json({ error: 'Program already exists for this department' });
    }

    const data = await Course.create({
      ...req.body,
      name,
      departmentId
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Academic
router.post('/academic', async (req, res) => {
  try {
    const courseId = req.body?.courseId;
    const year = toNumber(req.body?.year);
    const semester = toNumber(req.body?.semester);

    if (!courseId || year === null || semester === null) {
      return res.status(400).json({ error: 'courseId, year and semester are required' });
    }

    const existingAcademic = await findAcademicDuplicate(courseId, year, semester);
    if (existingAcademic) {
      return res.status(409).json({ error: 'Year/Term already exists for this program' });
    }

    const data = await Academic.create({
      ...req.body,
      courseId,
      year,
      semester
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Section
router.post('/section', async (req, res) => {
  try {
    const name = normalizeText(req.body?.name);
    const academicId = req.body?.academicId;

    if (!name || !academicId) {
      return res.status(400).json({ error: 'name and academicId are required' });
    }

    const existingSection = await findSectionByNameInsensitive(name, academicId);
    if (existingSection) {
      return res.status(409).json({ error: 'Section already exists for this year/term' });
    }

    const data = await Section.create({
      ...req.body,
      name,
      academicId
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Subject
router.post('/subject', async (req, res) => {
  try {
    const data = await Subject.create(req.body);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Teacher
router.post('/teacher', async (req, res) => {
  try {
    const data = await Teacher.create(req.body);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// ✅ UPDATE ROUTES
// =====================

router.put('/department/:id', async (req, res) => {
  try {
    const name = normalizeText(req.body?.name);
    if (!name) {
      return res.status(400).json({ error: 'Department name is required' });
    }

    const existingDepartment = await findDepartmentByNameInsensitive(name);
    if (existingDepartment && String(existingDepartment._id) !== String(req.params.id)) {
      return res.status(409).json({ error: 'Department already exists' });
    }

    const data = await Department.findByIdAndUpdate(
      req.params.id,
      { name },
      { new: true, runValidators: true }
    );

    if (!data) {
      return res.status(404).json({ error: 'Department not found' });
    }

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.put('/course/:id', async (req, res) => {
  try {
    const payload = {
      name: normalizeText(req.body?.name),
      departmentId: req.body?.departmentId
    };

    if (!payload.name || !payload.departmentId) {
      return res.status(400).json({ error: 'name and departmentId are required' });
    }

    const existingCourse = await findCourseByNameInsensitive(payload.name, payload.departmentId);
    if (existingCourse && String(existingCourse._id) !== String(req.params.id)) {
      return res.status(409).json({ error: 'Program already exists for this department' });
    }

    const data = await Course.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true
    });

    if (!data) {
      return res.status(404).json({ error: 'Program not found' });
    }

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.put('/academic/:id', async (req, res) => {
  try {
    const payload = {
      courseId: req.body?.courseId,
      year: toNumber(req.body?.year),
      semester: toNumber(req.body?.semester)
    };

    if (!payload.courseId || payload.year === null || payload.semester === null) {
      return res.status(400).json({ error: 'courseId, year and semester are required' });
    }

    const existingAcademic = await findAcademicDuplicate(payload.courseId, payload.year, payload.semester);
    if (existingAcademic && String(existingAcademic._id) !== String(req.params.id)) {
      return res.status(409).json({ error: 'Year/Term already exists for this program' });
    }

    const data = await Academic.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true
    });

    if (!data) {
      return res.status(404).json({ error: 'Year/Term not found' });
    }

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.put('/section/:id', async (req, res) => {
  try {
    const payload = {
      name: normalizeText(req.body?.name),
      academicId: req.body?.academicId
    };

    if (!payload.name || !payload.academicId) {
      return res.status(400).json({ error: 'name and academicId are required' });
    }

    const existingSection = await findSectionByNameInsensitive(payload.name, payload.academicId);
    if (existingSection && String(existingSection._id) !== String(req.params.id)) {
      return res.status(409).json({ error: 'Section already exists for this year/term' });
    }

    const data = await Section.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true
    });

    if (!data) {
      return res.status(404).json({ error: 'Section not found' });
    }

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.put('/section/:id/fixed-slots', async (req, res) => {
  try {
    const sectionId = req.params.id;
    if (!isValidId(sectionId)) {
      return res.status(400).json({ error: 'Invalid sectionId' });
    }

    const allowedDays = new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    const allowedPeriods = new Set([1, 2, 3, 4, 5, 6, 7, 8]);
    const rawSlots = Array.isArray(req.body?.fixedSlots) ? req.body.fixedSlots : [];

    const sanitizedSlots = rawSlots
      .map((slot) => ({
        day: String(slot?.day || '').trim(),
        period: Number(slot?.period),
        label: String(slot?.label || '').trim()
      }))
      .filter((slot) => allowedDays.has(slot.day) && allowedPeriods.has(slot.period))
      .map((slot) => ({
        ...slot,
        label: slot.label || 'Fixed Slot'
      }));

    const data = await Section.findByIdAndUpdate(
      sectionId,
      { fixedSlots: sanitizedSlots },
      { new: true, runValidators: true }
    );

    if (!data) {
      return res.status(404).json({ error: 'Section not found' });
    }

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.put('/subject/:id', async (req, res) => {
  try {
    const payload = {
      name: normalizeText(req.body?.name),
      courseId: req.body?.courseId
    };

    if (!payload.name || !payload.courseId) {
      return res.status(400).json({ error: 'name and courseId are required' });
    }

    const data = await Subject.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true
    });

    if (!data) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.put('/teacher/:id', async (req, res) => {
  try {
    const payload = {
      name: normalizeText(req.body?.name),
      departmentId: req.body?.departmentId,
      subjects: Array.isArray(req.body?.subjects) ? req.body.subjects : []
    };

    if (!payload.name || !payload.departmentId) {
      return res.status(400).json({ error: 'name and departmentId are required' });
    }

    const data = await Teacher.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true
    }).populate('subjects');

    if (!data) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// =====================
// ✅ DELETE ROUTES
// =====================

router.delete('/department/:id', async (req, res) => {
  try {
    const hasCourses = await Course.exists({ departmentId: req.params.id });
    const hasTeachers = await Teacher.exists({ departmentId: req.params.id });

    if (hasCourses || hasTeachers) {
      return res.status(400).json({
        error: 'Cannot delete department with linked programs/teachers. Delete linked records first.'
      });
    }

    const data = await Department.findByIdAndDelete(req.params.id);
    if (!data) {
      return res.status(404).json({ error: 'Department not found' });
    }

    return res.json({ message: 'Department deleted successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/course/:id', async (req, res) => {
  try {
    const hasAcademics = await Academic.exists({ courseId: req.params.id });
    const hasSubjects = await Subject.exists({ courseId: req.params.id });

    if (hasAcademics || hasSubjects) {
      return res.status(400).json({
        error: 'Cannot delete program with linked year/terms or subjects. Delete linked records first.'
      });
    }

    const data = await Course.findByIdAndDelete(req.params.id);
    if (!data) {
      return res.status(404).json({ error: 'Program not found' });
    }

    return res.json({ message: 'Program deleted successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/academic/:id', async (req, res) => {
  try {
    const hasSections = await Section.exists({ academicId: req.params.id });

    if (hasSections) {
      return res.status(400).json({
        error: 'Cannot delete year/term with linked sections. Delete linked sections first.'
      });
    }

    const data = await Academic.findByIdAndDelete(req.params.id);
    if (!data) {
      return res.status(404).json({ error: 'Year/Term not found' });
    }

    return res.json({ message: 'Year/Term deleted successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/section/:id', async (req, res) => {
  try {
    const hasTimetables = await Timetable.exists({ sectionId: req.params.id });
    if (hasTimetables) {
      return res.status(400).json({
        error: 'Cannot delete section with generated timetables. Delete timetable entries first.'
      });
    }

    const data = await Section.findByIdAndDelete(req.params.id);
    if (!data) {
      return res.status(404).json({ error: 'Section not found' });
    }

    return res.json({ message: 'Section deleted successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/subject/:id', async (req, res) => {
  try {
    const linkedTeacher = await Teacher.exists({ subjects: req.params.id });
    const linkedTimetable = await Timetable.exists({ 'entries.subjectId': req.params.id });

    if (linkedTeacher || linkedTimetable) {
      return res.status(400).json({
        error: 'Cannot delete subject linked to teachers or generated timetables.'
      });
    }

    const data = await Subject.findByIdAndDelete(req.params.id);
    if (!data) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    return res.json({ message: 'Subject deleted successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/teacher/:id', async (req, res) => {
  try {
    const linkedTimetable = await Timetable.exists({ 'entries.teacherId': req.params.id });

    if (linkedTimetable) {
      return res.status(400).json({
        error: 'Cannot delete teacher linked to generated timetables.'
      });
    }

    const data = await Teacher.findByIdAndDelete(req.params.id);
    if (!data) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    return res.json({ message: 'Teacher deleted successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});


// =====================
// ✅ GET ROUTES
// =====================

// Get all departments
router.get('/departments', async (req, res) => {
  try {
    console.log("👉 Departments API called");
    const data = await Department.find();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/courses', async (req, res) => {
  try {
    console.log("👉 Courses API called");
    const data = await Course.find();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get courses by department
router.get('/courses/:departmentId', async (req, res) => {
  try {
    const data = await Course.find({ departmentId: req.params.departmentId });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get academic by course
router.get('/academic/:courseId', async (req, res) => {
  try {
    const data = await Academic.find({ courseId: req.params.courseId });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get sections by academic
router.get('/sections/:academicId', async (req, res) => {
  try {
    const data = await Section.find({ academicId: req.params.academicId });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get subjects by course
router.get('/subjects/:courseId', async (req, res) => {
  try {
    const data = await Subject.find({ courseId: req.params.courseId });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get teachers by department
router.get('/teachers/:departmentId', async (req, res) => {
  try {
    const data = await Teacher.find({ departmentId: req.params.departmentId }).populate('subjects');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/teachers', async (req, res) => {
  try {
    const data = await Teacher.find().populate('subjects');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// =====================
// ✅ TEST ROUTE (IMPORTANT)
// =====================

router.get('/test', (req, res) => {
  res.send("✅ Master Routes Working");
});


module.exports = router;