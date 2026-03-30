import React, { useEffect, useRef, useState } from 'react';
import API from '../services/api';
import { notifyMasterDataChanged } from '../services/dataSync';
import auroraLogo from '../assets/image.png';
import './styles.css';

const dedupeDepartmentsByName = (items = []) => {
  const seen = new Set();
  return items.filter((department) => {
    const key = String(department?.name || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getEntityId = (value) => {
  if (!value) return '';
  if (typeof value === 'object') return value._id || '';
  return value;
};

function AdminDashboard() {
  const [departments, setDepartments] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [adminAcademics, setAdminAcademics] = useState([]);
  const [adminSubjects, setAdminSubjects] = useState([]);

  const [manageDepartmentId, setManageDepartmentId] = useState('');
  const [manageCourseId, setManageCourseId] = useState('');
  const [manageAcademicId, setManageAcademicId] = useState('');
  const [manageSectionId, setManageSectionId] = useState('');

  const [manageCourses, setManageCourses] = useState([]);
  const [manageAcademics, setManageAcademics] = useState([]);
  const [manageSections, setManageSections] = useState([]);
  const [manageSubjects, setManageSubjects] = useState([]);
  const [manageTeachers, setManageTeachers] = useState([]);
  const [manageTimetables, setManageTimetables] = useState([]);

  const [adminDepartmentName, setAdminDepartmentName] = useState('');
  const [adminCourseName, setAdminCourseName] = useState('');
  const [adminCourseDepartmentId, setAdminCourseDepartmentId] = useState('');
  const [adminAcademicCourseId, setAdminAcademicCourseId] = useState('');
  const [adminAcademicYear, setAdminAcademicYear] = useState('');
  const [adminAcademicSemester, setAdminAcademicSemester] = useState('');
  const [adminSectionAcademicId, setAdminSectionAcademicId] = useState('');
  const [adminSectionName, setAdminSectionName] = useState('');
  const [adminSubjectCourseId, setAdminSubjectCourseId] = useState('');
  const [adminSubjectName, setAdminSubjectName] = useState('');
  const [adminTeacherName, setAdminTeacherName] = useState('');
  const [adminTeacherDepartmentId, setAdminTeacherDepartmentId] = useState('');
  const [adminTeacherCourseId, setAdminTeacherCourseId] = useState('');
  const [adminTeacherSubjectIds, setAdminTeacherSubjectIds] = useState([]);
  const [adminStatus, setAdminStatus] = useState({ type: '', message: '' });

  const [uploadFile, setUploadFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const getErrorMessage = (error, fallback) => error.response?.data?.error || fallback;

  const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString();
  };

  const departmentMap = departments.reduce((acc, item) => {
    acc[item._id] = item.name;
    return acc;
  }, {});

  const courseMap = allCourses.reduce((acc, item) => {
    acc[item._id] = item.name;
    return acc;
  }, {});

  const loadDepartments = async () => {
    const res = await API.get('/master/departments');
    setDepartments(dedupeDepartmentsByName(res.data));
  };

  const loadAllCourses = async () => {
    const res = await API.get('/master/courses');
    setAllCourses(res.data);
  };

  const loadManageCoursesAndTeachers = async (departmentId) => {
    if (!departmentId) {
      setManageCourses([]);
      setManageTeachers([]);
      return;
    }

    const [coursesRes, teachersRes] = await Promise.all([
      API.get(`/master/courses/${departmentId}`),
      API.get(`/master/teachers/${departmentId}`)
    ]);

    setManageCourses(coursesRes.data);
    setManageTeachers(teachersRes.data);
  };

  const loadManageAcademicsAndSubjects = async (courseId) => {
    if (!courseId) {
      setManageAcademics([]);
      setManageSubjects([]);
      return;
    }

    const [academicsRes, subjectsRes] = await Promise.all([
      API.get(`/master/academic/${courseId}`),
      API.get(`/master/subjects/${courseId}`)
    ]);

    setManageAcademics(academicsRes.data);
    setManageSubjects(subjectsRes.data);
  };

  const loadManageSections = async (academicId) => {
    if (!academicId) {
      setManageSections([]);
      return;
    }

    const res = await API.get(`/master/sections/${academicId}`);
    setManageSections(res.data);
  };

  const loadManageTimetables = async (sectionId) => {
    if (!sectionId) {
      setManageTimetables([]);
      return;
    }

    const res = await API.get(`/timetable/section/${sectionId}/all`);
    setManageTimetables(res.data);
  };

  const loadAcademicsForAdmin = async (courseId) => {
    if (!courseId) {
      setAdminAcademics([]);
      return;
    }
    const res = await API.get(`/master/academic/${courseId}`);
    setAdminAcademics(res.data);
  };

  const loadSubjectsForAdmin = async (courseId) => {
    if (!courseId) {
      setAdminSubjects([]);
      return;
    }
    const res = await API.get(`/master/subjects/${courseId}`);
    setAdminSubjects(res.data);
  };

  useEffect(() => {
    Promise.all([loadDepartments(), loadAllCourses()]).catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    setManageCourseId('');
    setManageAcademicId('');
    setManageSectionId('');
    setManageAcademics([]);
    setManageSubjects([]);
    setManageSections([]);
    setManageTimetables([]);

    loadManageCoursesAndTeachers(manageDepartmentId).catch((error) => {
      setAdminStatus({ type: 'error', message: getErrorMessage(error, 'Failed to load program/teacher data.') });
    });
  }, [manageDepartmentId]);

  useEffect(() => {
    setManageAcademicId('');
    setManageSectionId('');
    setManageSections([]);
    setManageTimetables([]);

    loadManageAcademicsAndSubjects(manageCourseId).catch((error) => {
      setAdminStatus({ type: 'error', message: getErrorMessage(error, 'Failed to load year/term or subject data.') });
    });
  }, [manageCourseId]);

  useEffect(() => {
    setManageSectionId('');
    setManageTimetables([]);

    loadManageSections(manageAcademicId).catch((error) => {
      setAdminStatus({ type: 'error', message: getErrorMessage(error, 'Failed to load section data.') });
    });
  }, [manageAcademicId]);

  useEffect(() => {
    loadManageTimetables(manageSectionId).catch((error) => {
      setAdminStatus({ type: 'error', message: getErrorMessage(error, 'Failed to load generated timetables.') });
    });
  }, [manageSectionId]);

  const handleCreateDepartment = async () => {
    if (!adminDepartmentName.trim()) return;
    try {
      await API.post('/master/department', { name: adminDepartmentName.trim() });
      setAdminDepartmentName('');
      await loadDepartments();
      notifyMasterDataChanged();
      setAdminStatus({ type: 'success', message: 'Department created.' });
    } catch (error) {
      setAdminStatus({ type: 'error', message: getErrorMessage(error, 'Failed to create department.') });
    }
  };

  const handleCreateCourse = async () => {
    if (!adminCourseName.trim() || !adminCourseDepartmentId) return;
    try {
      await API.post('/master/course', {
        name: adminCourseName.trim(),
        departmentId: adminCourseDepartmentId
      });
      setAdminCourseName('');
      await loadAllCourses();
      if (manageDepartmentId === adminCourseDepartmentId) {
        await loadManageCoursesAndTeachers(manageDepartmentId);
      }
      notifyMasterDataChanged();
      setAdminStatus({ type: 'success', message: 'Program created.' });
    } catch (error) {
      setAdminStatus({ type: 'error', message: getErrorMessage(error, 'Failed to create program.') });
    }
  };

  const handleCreateAcademic = async () => {
    if (!adminAcademicCourseId || !adminAcademicYear || !adminAcademicSemester) return;
    try {
      await API.post('/master/academic', {
        courseId: adminAcademicCourseId,
        year: Number(adminAcademicYear),
        semester: Number(adminAcademicSemester)
      });
      setAdminAcademicYear('');
      setAdminAcademicSemester('');
      await loadAcademicsForAdmin(adminAcademicCourseId);
      if (manageCourseId === adminAcademicCourseId) {
        await loadManageAcademicsAndSubjects(manageCourseId);
      }
      notifyMasterDataChanged();
      setAdminStatus({ type: 'success', message: 'Year/Term created.' });
    } catch (error) {
      setAdminStatus({ type: 'error', message: getErrorMessage(error, 'Failed to create year/term.') });
    }
  };

  const handleCreateSection = async () => {
    if (!adminSectionName.trim() || !adminSectionAcademicId) return;
    try {
      await API.post('/master/section', {
        name: adminSectionName.trim(),
        academicId: adminSectionAcademicId
      });
      setAdminSectionName('');
      if (manageAcademicId === adminSectionAcademicId) {
        await loadManageSections(manageAcademicId);
      }
      notifyMasterDataChanged();
      setAdminStatus({ type: 'success', message: 'Section created.' });
    } catch (error) {
      setAdminStatus({ type: 'error', message: getErrorMessage(error, 'Failed to create section.') });
    }
  };

  const handleCreateSubject = async () => {
    if (!adminSubjectName.trim() || !adminSubjectCourseId) return;
    try {
      await API.post('/master/subject', {
        name: adminSubjectName.trim(),
        courseId: adminSubjectCourseId
      });
      setAdminSubjectName('');
      await loadSubjectsForAdmin(adminSubjectCourseId);
      if (manageCourseId === adminSubjectCourseId) {
        await loadManageAcademicsAndSubjects(manageCourseId);
      }
      notifyMasterDataChanged();
      setAdminStatus({ type: 'success', message: 'Specialization/Subject created.' });
    } catch (error) {
      setAdminStatus({ type: 'error', message: getErrorMessage(error, 'Failed to create specialization/subject.') });
    }
  };

  const handleCreateTeacher = async () => {
    if (!adminTeacherName.trim() || !adminTeacherDepartmentId) return;
    try {
      await API.post('/master/teacher', {
        name: adminTeacherName.trim(),
        departmentId: adminTeacherDepartmentId,
        subjects: adminTeacherSubjectIds
      });
      setAdminTeacherName('');
      setAdminTeacherSubjectIds([]);
      if (manageDepartmentId === adminTeacherDepartmentId) {
        await loadManageCoursesAndTeachers(manageDepartmentId);
      }
      notifyMasterDataChanged();
      setAdminStatus({ type: 'success', message: 'Teacher created.' });
    } catch (error) {
      setAdminStatus({ type: 'error', message: getErrorMessage(error, 'Failed to create teacher.') });
    }
  };

  const handleEditDepartment = async (department) => {
    const nextName = window.prompt('Edit department name', department.name || '');
    if (nextName === null) return;

    if (!nextName.trim()) {
      setAdminStatus({ type: 'error', message: 'Department name cannot be empty.' });
      return;
    }

    try {
      await API.put(`/master/department/${department._id}`, { name: nextName.trim() });
      await loadDepartments();
      setAdminStatus({ type: 'success', message: 'Department updated.' });
    } catch (error) {
      setAdminStatus({ type: 'error', message: getErrorMessage(error, 'Failed to update department.') });
    }
  };

  const handleDeleteDepartment = async (department) => {
    const ok = window.confirm(`Delete department "${department.name}"?`);
    if (!ok) return;

    try {
      await API.delete(`/master/department/${department._id}`);
      if (manageDepartmentId === department._id) {
        setManageDepartmentId('');
      }
      await Promise.all([loadDepartments(), loadAllCourses()]);
      setAdminStatus({ type: 'success', message: 'Department deleted.' });
    } catch (error) {
      setAdminStatus({ type: 'error', message: getErrorMessage(error, 'Failed to delete department.') });
    }
  };

  const handleEditCourse = async (course) => {
    const nextName = window.prompt('Edit program name', course.name || '');
    if (nextName === null) return;

    if (!nextName.trim()) {
      setAdminStatus({ type: 'error', message: 'Program name cannot be empty.' });
      return;
    }

    try {
      await API.put(`/master/course/${course._id}`, {
        name: nextName.trim(),
        departmentId: course.departmentId
      });
      await Promise.all([loadAllCourses(), loadManageCoursesAndTeachers(manageDepartmentId)]);
      setAdminStatus({ type: 'success', message: 'Program updated.' });
    } catch (error) {
      setAdminStatus({ type: 'error', message: getErrorMessage(error, 'Failed to update program.') });
    }
  };

  const handleDeleteCourse = async (course) => {
    const ok = window.confirm(`Delete program "${course.name}"?`);
    if (!ok) return;

    try {
      await API.delete(`/master/course/${course._id}`);
      if (manageCourseId === course._id) {
        setManageCourseId('');
      }
      await Promise.all([loadAllCourses(), loadManageCoursesAndTeachers(manageDepartmentId)]);
      setAdminStatus({ type: 'success', message: 'Program deleted.' });
    } catch (error) {
      setAdminStatus({ type: 'error', message: getErrorMessage(error, 'Failed to delete program.') });
    }
  };

  const handleEditAcademic = async (academic) => {
    const nextYear = window.prompt('Edit year', academic.year ?? '');
    if (nextYear === null) return;
    const nextSemester = window.prompt('Edit term/semester', academic.semester ?? '');
    if (nextSemester === null) return;

    if (!nextYear.trim() || !nextSemester.trim()) {
      setAdminStatus({ type: 'error', message: 'Year and term are required.' });
      return;
    }

    try {
      await API.put(`/master/academic/${academic._id}`, {
        courseId: academic.courseId,
        year: Number(nextYear),
        semester: Number(nextSemester)
      });
      await loadManageAcademicsAndSubjects(manageCourseId);
      setAdminStatus({ type: 'success', message: 'Year/Term updated.' });
    } catch (error) {
      setAdminStatus({ type: 'error', message: getErrorMessage(error, 'Failed to update year/term.') });
    }
  };

  const handleDeleteAcademic = async (academic) => {
    const ok = window.confirm(`Delete Year ${academic.year} Term ${academic.semester}?`);
    if (!ok) return;

    try {
      await API.delete(`/master/academic/${academic._id}`);
      if (manageAcademicId === academic._id) {
        setManageAcademicId('');
      }
      await loadManageAcademicsAndSubjects(manageCourseId);
      setAdminStatus({ type: 'success', message: 'Year/Term deleted.' });
    } catch (error) {
      setAdminStatus({ type: 'error', message: getErrorMessage(error, 'Failed to delete year/term.') });
    }
  };

  const handleEditSection = async (section) => {
    const nextName = window.prompt('Edit section name', section.name || '');
    if (nextName === null) return;

    if (!nextName.trim()) {
      setAdminStatus({ type: 'error', message: 'Section name cannot be empty.' });
      return;
    }

    try {
      await API.put(`/master/section/${section._id}`, {
        name: nextName.trim(),
        academicId: section.academicId
      });
      await loadManageSections(manageAcademicId);
      setAdminStatus({ type: 'success', message: 'Section updated.' });
    } catch (error) {
      setAdminStatus({ type: 'error', message: getErrorMessage(error, 'Failed to update section.') });
    }
  };

  const handleDeleteSection = async (section) => {
    const ok = window.confirm(`Delete section "${section.name}"?`);
    if (!ok) return;

    try {
      await API.delete(`/master/section/${section._id}`);
      if (manageSectionId === section._id) {
        setManageSectionId('');
      }
      await loadManageSections(manageAcademicId);
      setAdminStatus({ type: 'success', message: 'Section deleted.' });
    } catch (error) {
      setAdminStatus({ type: 'error', message: getErrorMessage(error, 'Failed to delete section.') });
    }
  };

  const handleEditSubject = async (subject) => {
    const nextName = window.prompt('Edit subject name', subject.name || '');
    if (nextName === null) return;

    if (!nextName.trim()) {
      setAdminStatus({ type: 'error', message: 'Subject name cannot be empty.' });
      return;
    }

    try {
      await API.put(`/master/subject/${subject._id}`, {
        name: nextName.trim(),
        courseId: subject.courseId
      });
      await loadManageAcademicsAndSubjects(manageCourseId);
      setAdminStatus({ type: 'success', message: 'Subject updated.' });
    } catch (error) {
      setAdminStatus({ type: 'error', message: getErrorMessage(error, 'Failed to update subject.') });
    }
  };

  const handleDeleteSubject = async (subject) => {
    const ok = window.confirm(`Delete subject "${subject.name}"?`);
    if (!ok) return;

    try {
      await API.delete(`/master/subject/${subject._id}`);
      await loadManageAcademicsAndSubjects(manageCourseId);
      setAdminStatus({ type: 'success', message: 'Subject deleted.' });
    } catch (error) {
      setAdminStatus({ type: 'error', message: getErrorMessage(error, 'Failed to delete subject.') });
    }
  };

  const handleEditTeacher = async (teacher) => {
    const nextName = window.prompt('Edit teacher name', teacher.name || '');
    if (nextName === null) return;

    if (!nextName.trim()) {
      setAdminStatus({ type: 'error', message: 'Teacher name cannot be empty.' });
      return;
    }

    try {
      await API.put(`/master/teacher/${teacher._id}`, {
        name: nextName.trim(),
        departmentId: teacher.departmentId,
        subjects: (teacher.subjects || []).map((subject) => subject._id || subject)
      });
      await loadManageCoursesAndTeachers(manageDepartmentId);
      setAdminStatus({ type: 'success', message: 'Teacher updated.' });
    } catch (error) {
      setAdminStatus({ type: 'error', message: getErrorMessage(error, 'Failed to update teacher.') });
    }
  };

  const handleDeleteTeacher = async (teacher) => {
    const ok = window.confirm(`Delete teacher "${teacher.name}"?`);
    if (!ok) return;

    try {
      await API.delete(`/master/teacher/${teacher._id}`);
      await loadManageCoursesAndTeachers(manageDepartmentId);
      setAdminStatus({ type: 'success', message: 'Teacher deleted.' });
    } catch (error) {
      setAdminStatus({ type: 'error', message: getErrorMessage(error, 'Failed to delete teacher.') });
    }
  };

  const handleDeleteTimetable = async (timetable) => {
    const ok = window.confirm('Delete this generated timetable? This action cannot be undone.');
    if (!ok) return;

    try {
      await API.delete(`/timetable/${timetable._id}`);
      await loadManageTimetables(manageSectionId);
      setAdminStatus({ type: 'success', message: 'Generated timetable deleted.' });
    } catch (error) {
      setAdminStatus({ type: 'error', message: getErrorMessage(error, 'Failed to delete generated timetable.') });
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) {
      setUploadError('Please choose a file first.');
      setUploadMessage('');
      return;
    }

    try {
      setIsUploading(true);
      setUploadError('');
      setUploadMessage('');

      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('entity', 'mixed');

      const response = await API.post('/master/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setUploadMessage(
        `Imported ${response.data.importedCount} row(s). Skipped ${response.data.skippedCount} row(s).`
      );
      await Promise.all([loadDepartments(), loadAllCourses()]);
      notifyMasterDataChanged();
      setUploadFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      setUploadError(error.response?.data?.error || 'Upload failed. Please check file format and data columns.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="generator-page">
      <header className="top-bar">
        <div className="brand-text">
          <h2>Aurora University TimeTable Portal</h2>
          <p>Admin Data Management</p>
        </div>
        <img src={auroraLogo} alt="Aurora University" className="uni-logo right-logo" />
      </header>

      <div className="container">
        <h1>Admin Dashboard</h1>
        <p className="subtitle">Add departments, programs, terms, sections, subjects, and teachers.</p>

        <div className="upload-panel">
          <h3>Bulk Upload Mixed Data (Excel)</h3>
          <p>Upload one mixed .xlsx or .xls file containing all required entities.</p>

          <div className="upload-controls">
            <input
              ref={fileInputRef}
              className="hidden-file-input"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            />

            <button
              type="button"
              className="choose-file-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose Excel
            </button>

            <div className="file-name-display">
              {uploadFile ? uploadFile.name : 'No file chosen'}
            </div>

            <button className="generate-btn upload-btn" onClick={handleUpload} disabled={isUploading}>
              {isUploading ? 'Uploading...' : 'Upload File'}
            </button>
          </div>

          {uploadMessage && <div className="upload-status success">{uploadMessage}</div>}
          {uploadError && <div className="upload-status error">{uploadError}</div>}
        </div>

        <div className="admin-panel">
          <h3>Admin Data Entry</h3>
          <p>Use these quick forms to add schools/departments, programs, year/terms, sections, subjects, and teachers.</p>

          <div className="admin-grid">
            <div className="admin-card">
              <h4>School / Department</h4>
              <input
                type="text"
                placeholder="Department name"
                value={adminDepartmentName}
                onChange={(e) => setAdminDepartmentName(e.target.value)}
              />
              <button className="generate-btn" onClick={handleCreateDepartment}>
                Add Department
              </button>
            </div>

            <div className="admin-card">
              <h4>Program</h4>
              <select
                value={adminCourseDepartmentId}
                onChange={(e) => setAdminCourseDepartmentId(e.target.value)}
              >
                <option value="">Select Department</option>
                {departments.map((dep) => (
                  <option key={dep._id} value={dep._id}>{dep.name}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Program name"
                value={adminCourseName}
                onChange={(e) => setAdminCourseName(e.target.value)}
              />
              <button className="generate-btn" onClick={handleCreateCourse}>
                Add Program
              </button>
            </div>

            <div className="admin-card">
              <h4>Year / Term</h4>
              <select
                value={adminAcademicCourseId}
                onChange={(e) => {
                  setAdminAcademicCourseId(e.target.value);
                  loadAcademicsForAdmin(e.target.value);
                }}
              >
                <option value="">Select Program</option>
                {allCourses.map((course) => (
                  <option key={course._id} value={course._id}>{course.name}</option>
                ))}
              </select>
              <div className="admin-inline">
                <input
                  type="number"
                  placeholder="Year"
                  value={adminAcademicYear}
                  onChange={(e) => setAdminAcademicYear(e.target.value)}
                />
                <input
                  type="number"
                  placeholder="Term"
                  value={adminAcademicSemester}
                  onChange={(e) => setAdminAcademicSemester(e.target.value)}
                />
              </div>
              <button className="generate-btn" onClick={handleCreateAcademic}>
                Add Year/Term
              </button>
            </div>

            <div className="admin-card">
              <h4>Section</h4>
              <select
                value={adminAcademicCourseId}
                onChange={(e) => {
                  setAdminAcademicCourseId(e.target.value);
                  loadAcademicsForAdmin(e.target.value);
                }}
              >
                <option value="">Select Program</option>
                {allCourses.map((course) => (
                  <option key={course._id} value={course._id}>{course.name}</option>
                ))}
              </select>
              <select
                value={adminSectionAcademicId}
                onChange={(e) => setAdminSectionAcademicId(e.target.value)}
              >
                <option value="">Select Year/Term</option>
                {adminAcademics.map((item) => (
                  <option key={item._id} value={item._id}>
                    Year {item.year} - Term {item.semester}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Section name"
                value={adminSectionName}
                onChange={(e) => setAdminSectionName(e.target.value)}
              />
              <button className="generate-btn" onClick={handleCreateSection}>
                Add Section
              </button>
            </div>

            <div className="admin-card">
              <h4>Specialization / Subject</h4>
              <select
                value={adminSubjectCourseId}
                onChange={(e) => {
                  setAdminSubjectCourseId(e.target.value);
                  loadSubjectsForAdmin(e.target.value);
                }}
              >
                <option value="">Select Program</option>
                {allCourses.map((course) => (
                  <option key={course._id} value={course._id}>{course.name}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Subject name"
                value={adminSubjectName}
                onChange={(e) => setAdminSubjectName(e.target.value)}
              />
              <button className="generate-btn" onClick={handleCreateSubject}>
                Add Subject
              </button>
            </div>

            <div className="admin-card">
              <h4>Teacher</h4>
              <select
                value={adminTeacherDepartmentId}
                onChange={(e) => setAdminTeacherDepartmentId(e.target.value)}
              >
                <option value="">Select Department</option>
                {departments.map((dep) => (
                  <option key={dep._id} value={dep._id}>{dep.name}</option>
                ))}
              </select>
              <select
                value={adminTeacherCourseId}
                onChange={(e) => {
                  setAdminTeacherCourseId(e.target.value);
                  loadSubjectsForAdmin(e.target.value);
                }}
              >
                <option value="">Select Program</option>
                {allCourses.map((course) => (
                  <option key={course._id} value={course._id}>{course.name}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Teacher name"
                value={adminTeacherName}
                onChange={(e) => setAdminTeacherName(e.target.value)}
              />
              <div className="admin-subjects">
                {adminSubjects.length === 0 && (
                  <p className="hint">Select a program to choose subjects (max 4).</p>
                )}
                {adminSubjects.map((subject) => (
                  <label key={subject._id} className="checkbox">
                    <input
                      type="checkbox"
                      checked={adminTeacherSubjectIds.includes(subject._id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          if (adminTeacherSubjectIds.length >= 4) return;
                          setAdminTeacherSubjectIds([...adminTeacherSubjectIds, subject._id]);
                        } else {
                          setAdminTeacherSubjectIds(adminTeacherSubjectIds.filter((id) => id !== subject._id));
                        }
                      }}
                    />
                    {subject.name}
                  </label>
                ))}
              </div>
              <button className="generate-btn" onClick={handleCreateTeacher}>
                Add Teacher
              </button>
            </div>
          </div>

          {adminStatus.message && (
            <div className={`admin-status ${adminStatus.type}`}>
              {adminStatus.message}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default AdminDashboard;
