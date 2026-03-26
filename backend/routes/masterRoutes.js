const express = require('express');
const router = express.Router();

const Department = require('../models/Department');
const Course = require('../models/Course');
const Academic = require('../models/Academic');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const Teacher = require('../models/Teacher');


// =====================
// ✅ POST ROUTES
// =====================

// Add Department
router.post('/department', async (req, res) => {
  try {
    const data = await Department.create(req.body);
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