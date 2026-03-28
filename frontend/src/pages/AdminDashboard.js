import React, { useEffect, useRef, useState } from 'react';
import API from '../services/api';
import auroraLogo from '../assets/image.png';
import './styles.css';

function AdminDashboard() {
  const [departments, setDepartments] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [adminAcademics, setAdminAcademics] = useState([]);
  const [adminSubjects, setAdminSubjects] = useState([]);

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

  const loadDepartments = async () => {
    const res = await API.get('/master/departments');
    setDepartments(res.data);
  };

  const loadAllCourses = async () => {
    const res = await API.get('/master/courses');
    setAllCourses(res.data);
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

  const handleCreateDepartment = async () => {
    if (!adminDepartmentName.trim()) return;
    try {
      await API.post('/master/department', { name: adminDepartmentName.trim() });
      setAdminDepartmentName('');
      await loadDepartments();
      setAdminStatus({ type: 'success', message: 'Department created.' });
    } catch (error) {
      setAdminStatus({ type: 'error', message: error.response?.data?.error || 'Failed to create department.' });
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
      setAdminStatus({ type: 'success', message: 'Program created.' });
    } catch (error) {
      setAdminStatus({ type: 'error', message: error.response?.data?.error || 'Failed to create program.' });
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
      setAdminStatus({ type: 'success', message: 'Year/Term created.' });
    } catch (error) {
      setAdminStatus({ type: 'error', message: error.response?.data?.error || 'Failed to create year/term.' });
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
      setAdminStatus({ type: 'success', message: 'Section created.' });
    } catch (error) {
      setAdminStatus({ type: 'error', message: error.response?.data?.error || 'Failed to create section.' });
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
      setAdminStatus({ type: 'success', message: 'Specialization/Subject created.' });
    } catch (error) {
      setAdminStatus({ type: 'error', message: error.response?.data?.error || 'Failed to create specialization/subject.' });
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
      setAdminStatus({ type: 'success', message: 'Teacher created.' });
    } catch (error) {
      setAdminStatus({ type: 'error', message: error.response?.data?.error || 'Failed to create teacher.' });
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

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('authToken');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('authToken');
    delete API.defaults.headers.common.Authorization;
    window.location.href = '/';
  };

  return (
    <div className="generator-page">
      <button className="logout-btn corner-logout" onClick={handleLogout}>Logout</button>

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
