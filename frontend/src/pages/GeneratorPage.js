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
  const [teachers, setTeachers] = useState([]);

  const [selected, setSelected] = useState({
    departmentId: '',
    courseId: '',
    academicId: '',
    sectionId: ''
  });

  const [timetable, setTimetable] = useState({});
  const [displaySlots, setDisplaySlots] = useState([]);
  const [timetableId, setTimetableId] = useState('');
  const [remainingBySubject, setRemainingBySubject] = useState({});
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  // ================= LOAD DEPARTMENTS =================
  const loadDepartments = async () => {
    const res = await API.get('/master/departments');
    setDepartments(res.data);
  };

  useEffect(() => {
    loadDepartments().catch(err => console.error(err));
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
    const resTeachers = await API.get(`/master/teachers/${departmentId}`);
    setTeachers(resTeachers.data);
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

    const { timetable: timetableDoc, displaySlots: slots, remainingBySubject: remaining } = res.data;
    const data = timetableDoc.entries;

    const formatted = {};

    data.forEach(item => {
      if (!formatted[item.day]) formatted[item.day] = {};
      formatted[item.day][item.period] = {
        subjectId: item.subjectId,
        teacherId: item.teacherId
      };
    });

    setTimetable(formatted);
    setDisplaySlots(slots || []);
    setTimetableId(timetableDoc._id || '');
    setRemainingBySubject(remaining || {});
  };

  const handleDownload = async () => {
    if (!timetableId) return;

    try {
      setIsDownloading(true);
      setDownloadError('');
      const response = await API.get(`/timetable/download/${timetableId}`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'timetable.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setDownloadError(error.response?.data?.error || 'Download failed.');
    } finally {
      setIsDownloading(false);
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


  // ================= SUBJECT NAME MAP =================
  const subjectMap = {};
  subjects.forEach(s => {
    subjectMap[s._id] = s.name;
  });

  const teacherMap = {};
  teachers.forEach(t => {
    teacherMap[t._id] = t.name;
  });

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const fallbackSlots = [
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
  const slotColumns = displaySlots.length ? displaySlots : fallbackSlots;
  const canGenerate =
    selected.departmentId &&
    selected.courseId &&
    selected.academicId &&
    selected.sectionId;

  const selectedDepartment = departments.find((dep) => dep._id === selected.departmentId);
  const selectedCourse = courses.find((course) => course._id === selected.courseId);
  const selectedAcademic = academics.find((academic) => academic._id === selected.academicId);
  const selectedSection = sections.find((section) => section._id === selected.sectionId);

  const remainingItems = Object.entries(remainingBySubject)
    .filter(([, remaining]) => remaining > 0)
    .map(([subjectId, remaining]) => ({
      name: subjectMap[subjectId] || 'Unknown subject',
      remaining
    }));

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

          <button
            className="generate-btn download-btn"
            onClick={handleDownload}
            disabled={!timetableId || isDownloading}
          >
            {isDownloading ? 'Downloading...' : '⬇️ Download Timetable'}
          </button>

        </div>

        {/* ================= TABLE ================= */}
        {Object.keys(timetable).length > 0 && (
          <div className="selection-summary">
            <div className="summary-item">
              <span>School</span>
              <strong>{selectedDepartment?.name || '—'}</strong>
            </div>
            <div className="summary-item">
              <span>Program</span>
              <strong>{selectedCourse?.name || '—'}</strong>
            </div>
            <div className="summary-item">
              <span>Year</span>
              <strong>{selectedAcademic?.year ? `Year ${selectedAcademic.year}` : '—'}</strong>
            </div>
            <div className="summary-item">
              <span>Term</span>
              <strong>{selectedAcademic?.semester ? `Term ${selectedAcademic.semester}` : '—'}</strong>
            </div>
            <div className="summary-item">
              <span>Section</span>
              <strong>{selectedSection?.name || '—'}</strong>
            </div>
          </div>
        )}

        {Object.keys(timetable).length > 0 && (
          <div className="table-shell">
            <table className="timetable">

              <thead>
                <tr>
                  <th>Day</th>
                  {slotColumns.map((slot, index) => (
                    <th key={slot.label || slot.period || index}>
                      <div className="slot-header">
                        <span>{slot.label || `P${slot.period}`}</span>
                        <small>{slot.start} - {slot.end}</small>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {days.map(day => (
                  <tr key={day}>
                    <td><b>{day}</b></td>

                    {slotColumns.map((slot, index) => (
                      <td key={`${day}-${slot.label || slot.period || index}`}>
                        {slot.isBreak
                          ? 'Lunch'
                          : subjectMap[timetable[day]?.[slot.period]?.subjectId] || '—'}
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

        {downloadError && <div className="download-error">{downloadError}</div>}

        {remainingItems.length > 0 && (
          <div className="remaining-panel">
            <h3>Remaining Classes (per week)</h3>
            <div className="remaining-grid">
              {remainingItems.map((item) => (
                <div key={item.name} className="remaining-card">
                  <span>{item.name}</span>
                  <strong>{item.remaining}</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        {Object.keys(timetable).length > 0 && (
          <div className="teacher-panel">
            <h3>Course - Teacher Allocation</h3>
            <table className="teacher-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Teacher</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const pairs = new Map();
                  Object.values(timetable).forEach((daySlots) => {
                    Object.values(daySlots).forEach((slot) => {
                      if (!slot?.subjectId || !slot?.teacherId) return;
                      const key = `${slot.subjectId}-${slot.teacherId}`;
                      if (!pairs.has(key)) {
                        pairs.set(key, {
                          subjectName: subjectMap[slot.subjectId] || '—',
                          teacherName: teacherMap[slot.teacherId] || '—'
                        });
                      }
                    });
                  });

                  return Array.from(pairs.entries()).map(([key, item]) => (
                    <tr key={key}>
                      <td>{item.subjectName}</td>
                      <td>{item.teacherName}</td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        )}

      </div>

    </div>
  );
}

export default GeneratorPage;