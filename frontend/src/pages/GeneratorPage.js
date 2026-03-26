import React, { useEffect, useState } from 'react';
import API from '../services/api';
import auroraLogo from '../assets/image.png';
import './styles.css';

function GeneratorPage() {

  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [academics, setAcademics] = useState([]);
  const [sections, setSections] = useState([]);

  const [subjects, setSubjects] = useState([]);

  const [selected, setSelected] = useState({
    departmentId: '',
    courseId: '',
    academicId: '',
    sectionId: ''
  });

  const [timetable, setTimetable] = useState({});
  const [uploadEntity, setUploadEntity] = useState('subject');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // ================= LOAD DEPARTMENTS =================
  useEffect(() => {
    API.get('/master/departments')
      .then(res => setDepartments(res.data))
      .catch(err => console.error(err));
  }, []);

  // ================= DEPARTMENT CHANGE =================
  const handleDepartmentChange = async (e) => {
    const departmentId = e.target.value;

    setSelected({
      departmentId,
      courseId: '',
      academicId: '',
      sectionId: ''
    });

    const res = await API.get(`/master/courses/${departmentId}`);
    setCourses(res.data);
    setAcademics([]);
    setSections([]);
  };

  // ================= COURSE CHANGE =================
  const handleCourseChange = async (e) => {
    const courseId = e.target.value;

    setSelected(prev => ({
      ...prev,
      courseId,
      academicId: '',
      sectionId: ''
    }));

    const res1 = await API.get(`/master/academic/${courseId}`);
    setAcademics(res1.data);

    const res2 = await API.get(`/master/subjects/${courseId}`);
    setSubjects(res2.data);

    setSections([]);
  };

  // ================= ACADEMIC CHANGE =================
  const handleAcademicChange = async (e) => {
    const academicId = e.target.value;

    setSelected(prev => ({
      ...prev,
      academicId,
      sectionId: ''
    }));

    const res = await API.get(`/master/sections/${academicId}`);
    setSections(res.data);
  };

  // ================= GENERATE TIMETABLE =================
  const handleGenerate = async () => {
    const res = await API.post('/timetable/generate', {
      departmentId: selected.departmentId,
      courseId: selected.courseId,
      sectionId: selected.sectionId
    });

    const data = res.data.entries;

    const formatted = {};

    data.forEach(item => {
      if (!formatted[item.day]) formatted[item.day] = {};
      formatted[item.day][item.period] = item.subjectId;
    });

    setTimetable(formatted);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('authToken');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('authToken');
    delete API.defaults.headers.common.Authorization;
    window.location.href = '/';
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
      formData.append('entity', uploadEntity);

      if (selected.departmentId) formData.append('departmentId', selected.departmentId);
      if (selected.courseId) formData.append('courseId', selected.courseId);
      if (selected.academicId) formData.append('academicId', selected.academicId);

      const response = await API.post('/master/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setUploadMessage(
        `Imported ${response.data.importedCount} row(s). Skipped ${response.data.skippedCount} row(s).`
      );
      setUploadFile(null);
    } catch (error) {
      setUploadError(error.response?.data?.error || 'Upload failed. Please check file format and data columns.');
    } finally {
      setIsUploading(false);
    }
  };

  // ================= SUBJECT NAME MAP =================
  const subjectMap = {};
  subjects.forEach(s => {
    subjectMap[s._id] = s.name;
  });

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const periods = [1, 2, 3, 4, 5];
  const canGenerate =
    selected.departmentId &&
    selected.courseId &&
    selected.academicId &&
    selected.sectionId;

  return (
    <div className="generator-page">
      <button className="logout-btn corner-logout" onClick={handleLogout}>Logout</button>

      <header className="top-bar">
        <div className="brand-text">
          <h2>Aurora University TimeTable Portal</h2>
          <p>Academic Scheduling Dashboard</p>
        </div>
        <img src={auroraLogo} alt="Aurora University" className="uni-logo right-logo" />
      </header>

      <div className="container">

        <h1>🎓 TimeTable Generator</h1>
        <p className="subtitle">Professional timetable planning for departments, teachers and sections</p>

        <div className="card">

          {/* Department */}
          <select value={selected.departmentId} onChange={handleDepartmentChange}>
            <option value="">Select Department</option>
            {departments.map(dep => (
              <option key={dep._id} value={dep._id}>{dep.name}</option>
            ))}
          </select>

          {/* Course */}
          <select value={selected.courseId} onChange={handleCourseChange} disabled={!selected.departmentId}>
            <option value="">Select Course</option>
            {courses.map(c => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>

          {/* Academic */}
          <select value={selected.academicId} onChange={handleAcademicChange} disabled={!selected.courseId}>
            <option value="">Select Year / Semester</option>
            {academics.map(a => (
              <option key={a._id} value={a._id}>
                Year {a.year} - Sem {a.semester}
              </option>
            ))}
          </select>

          {/* Section */}
          <select
            value={selected.sectionId}
            onChange={(e) =>
              setSelected(prev => ({ ...prev, sectionId: e.target.value }))
            }
            disabled={!selected.academicId}
          >
            <option value="">Select Section</option>
            {sections.map(s => (
              <option key={s._id} value={s._id}>{s.name}</option>
            ))}
          </select>

          <button className="generate-btn" onClick={handleGenerate} disabled={!canGenerate}>
            🚀 Generate Timetable
          </button>

        </div>

        <div className="upload-panel">
          <h3>Bulk Upload Data (Excel / Word)</h3>
          <p>Upload `.xlsx`, `.xls`, `.csv`, or `.docx` file for the selected data type.</p>

          <div className="upload-controls">
            <select
              value={uploadEntity}
              onChange={(e) => setUploadEntity(e.target.value)}
            >
              <option value="department">Department</option>
              <option value="course">Course</option>
              <option value="academic">Academic</option>
              <option value="section">Section</option>
              <option value="subject">Subject</option>
              <option value="teacher">Teacher</option>
            </select>

            <input
              type="file"
              accept=".xlsx,.xls,.csv,.docx"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            />

            <button className="generate-btn upload-btn" onClick={handleUpload} disabled={isUploading}>
              {isUploading ? 'Uploading...' : 'Upload File'}
            </button>
          </div>

          {uploadMessage && <div className="upload-status success">{uploadMessage}</div>}
          {uploadError && <div className="upload-status error">{uploadError}</div>}
        </div>

        {/* ================= TABLE ================= */}
        {Object.keys(timetable).length > 0 && (
          <div className="table-shell">
            <table className="timetable">

              <thead>
                <tr>
                  <th>Day</th>
                  {periods.map(p => (
                    <th key={p}>P{p}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {days.map(day => (
                  <tr key={day}>
                    <td><b>{day}</b></td>

                    {periods.map(p => (
                      <td key={p}>
                        {subjectMap[timetable[day]?.[p]] || '—'}
                      </td>
                    ))}

                  </tr>
                ))}
              </tbody>

            </table>
          </div>
        )}

        {Object.keys(timetable).length === 0 && (
          <div className="empty-state" role="status" aria-live="polite">
            <h3>Ready to Generate Timetable</h3>
            <p>Select department, course, year/semester, and section, then click Generate Timetable.</p>
          </div>
        )}

      </div>

    </div>
  );
}

export default GeneratorPage;