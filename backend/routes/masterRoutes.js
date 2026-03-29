const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const mammoth = require('mammoth');

const Department = require('../models/Department');
const Course = require('../models/Course');
const Academic = require('../models/Academic');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const Teacher = require('../models/Teacher');

const upload = multer({ storage: multer.memoryStorage() });

const normalizeText = (value) => String(value ?? '').trim();

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findDepartmentByNameInsensitive = async (name) => {
  const normalized = normalizeText(name);
  if (!normalized) return null;

  return Department.findOne({
    name: { $regex: `^${escapeRegExp(normalized)}$`, $options: 'i' }
  });
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
    const data = await Course.create(req.body);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Academic
router.post('/academic', async (req, res) => {
  try {
    const data = await Academic.create(req.body);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Section
router.post('/section', async (req, res) => {
  try {
    const data = await Section.create(req.body);
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


// =====================
// ✅ TEST ROUTE (IMPORTANT)
// =====================

router.get('/test', (req, res) => {
  res.send("✅ Master Routes Working");
});


module.exports = router;