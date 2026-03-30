import React, { useCallback, useEffect, useRef, useState } from 'react';
import API from '../services/api';
import { MASTER_DATA_SYNC_KEY, MASTER_DATA_UPDATED_EVENT } from '../services/dataSync';
import auroraLogo from '../assets/image.png';
import './styles.css';

const dedupeSectionsByName = (items = []) => {
  const seen = new Set();
  return items.filter((section) => {
    const key = String(section?.name || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

function GeneratorPage({ embedded = false }) {

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
  const selectedRef = useRef(selected);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  // ================= LOAD DEPARTMENTS =================
  const loadDepartments = async () => {
    const res = await API.get('/master/departments');
    setDepartments(res.data);
    return res.data;
  };

  const syncHierarchyFromSelection = useCallback(async () => {
    const current = selectedRef.current;
    const latestDepartments = await loadDepartments();

    if (!current.departmentId) {
      setCourses([]);
      setTeachers([]);
      setAcademics([]);
      setSubjects([]);
      setSections([]);
      return;
    }

    const selectedDepartmentExists = latestDepartments.some((item) => item._id === current.departmentId);
    if (!selectedDepartmentExists) {
      setSelected({ departmentId: '', courseId: '', academicId: '', sectionId: '' });
      setCourses([]);
      setTeachers([]);
      setAcademics([]);
      setSubjects([]);
      setSections([]);
      return;
    }

    const [coursesRes, teachersRes] = await Promise.all([
      API.get(`/master/courses/${current.departmentId}`),
      API.get(`/master/teachers/${current.departmentId}`)
    ]);
    const latestCourses = coursesRes.data;
    setCourses(latestCourses);
    setTeachers(teachersRes.data);

    if (!current.courseId) {
      setAcademics([]);
      setSubjects([]);
      setSections([]);
      return;
    }

    const selectedCourseExists = latestCourses.some((item) => item._id === current.courseId);
    if (!selectedCourseExists) {
      setSelected((prev) => ({ ...prev, courseId: '', academicId: '', sectionId: '' }));
      setAcademics([]);
      setSubjects([]);
      setSections([]);
      return;
    }

    const [academicsRes, subjectsRes] = await Promise.all([
      API.get(`/master/academic/${current.courseId}`),
      API.get(`/master/subjects/${current.courseId}`)
    ]);
    const latestAcademics = academicsRes.data;
    setAcademics(latestAcademics);
    setSubjects(subjectsRes.data);

    if (!current.academicId) {
      setSections([]);
      return;
    }

    const selectedAcademicExists = latestAcademics.some((item) => item._id === current.academicId);
    if (!selectedAcademicExists) {
      setSelected((prev) => ({ ...prev, academicId: '', sectionId: '' }));
      setSections([]);
      return;
    }

    const sectionsRes = await API.get(`/master/sections/${current.academicId}`);
    const latestSections = dedupeSectionsByName(sectionsRes.data);
    setSections(latestSections);

    if (!current.sectionId) {
      return;
    }

    const selectedSectionExists = latestSections.some((item) => item._id === current.sectionId);
    if (!selectedSectionExists) {
      setSelected((prev) => ({ ...prev, sectionId: '' }));
    }
  }, []);

  useEffect(() => {
    syncHierarchyFromSelection().catch((err) => console.error(err));
  }, [syncHierarchyFromSelection]);

  useEffect(() => {
    const refreshOnChange = () => {
      syncHierarchyFromSelection().catch((err) => console.error(err));
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshOnChange();
      }
    };

    const handleStorage = (event) => {
      if (event.key === MASTER_DATA_SYNC_KEY) {
        refreshOnChange();
      }
    };

    window.addEventListener(MASTER_DATA_UPDATED_EVENT, refreshOnChange);
    window.addEventListener('focus', refreshOnChange);
    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener(MASTER_DATA_UPDATED_EVENT, refreshOnChange);
      window.removeEventListener('focus', refreshOnChange);
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [syncHierarchyFromSelection]);

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
    setSections(dedupeSectionsByName(res.data));
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

      const contentDisposition = response.headers?.['content-disposition'] || '';
      const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
      const filename = filenameMatch?.[1] || 'timetable.doc';

      const blob = new Blob([response.data], {
        type: 'application/msword'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
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
    <div className={`generator-page ${embedded ? 'generator-embedded' : ''}`}>
      {!embedded && (
        <header className="top-bar">
          <div className="brand-text">
            <h2>Aurora University TimeTable Portal</h2>
            <p>Academic Scheduling Dashboard</p>
          </div>
          <img src={auroraLogo} alt="Aurora University" className="uni-logo right-logo" />
        </header>
      )}

      <div className="container">

        <h1> TimeTable Generator</h1>
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
            <option value="">Select Year / Term</option>
            {academics.map(a => (
              <option key={a._id} value={a._id}>
                Year {a.year} - Term {a.semester}
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
           Generate Timetable
          </button>

          <button
            className="generate-btn download-btn"
            onClick={handleDownload}
            disabled={!timetableId || isDownloading}
          >
            {isDownloading ? 'Downloading...' : '⬇️ Download Timetable (Word)'}
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
                          : (subjectMap[timetable[day]?.[slot.period]?.subjectId] || 'Free Slot')}
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
            <p>Select department, course, year/term, and section, then click Generate Timetable.</p>
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