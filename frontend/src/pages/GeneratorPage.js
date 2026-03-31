import React, { useCallback, useEffect, useRef, useState } from 'react';
import API from '../services/api';
import { MASTER_DATA_SYNC_KEY, MASTER_DATA_UPDATED_EVENT } from '../services/dataSync';
import auroraLogo from '../assets/image.png';
import './styles.css';

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
    academicId: ''
  });

  const [generatedTimetables, setGeneratedTimetables] = useState([]);
  const [displaySlots, setDisplaySlots] = useState([]);
  const [downloadingId, setDownloadingId] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [showFixedSlots, setShowFixedSlots] = useState(false);
  const [fixedSlotLabel, setFixedSlotLabel] = useState('Extra Activity');
  const [fixedSlotMap, setFixedSlotMap] = useState({});
  const [maxFixedSlots, setMaxFixedSlots] = useState(0);
  const [selectedFixedSectionId, setSelectedFixedSectionId] = useState('');
  const [fixedSlotMessage, setFixedSlotMessage] = useState('');
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

  const loadSectionsByAcademicId = async (academicId) => {
    if (!academicId) {
      setSections([]);
      setSelectedFixedSectionId('');
      setFixedSlotMap({});
      setMaxFixedSlots(0);
      return [];
    }

    const res = await API.get(`/master/sections/${academicId}`);
    const list = res.data || [];
    setSections(list);
    return list;
  };

  const syncHierarchyFromSelection = useCallback(async () => {
    const current = selectedRef.current;
    const latestDepartments = await loadDepartments();

    if (!current.departmentId) {
      setCourses([]);
      setTeachers([]);
      setAcademics([]);
      setSubjects([]);
      return;
    }

    const selectedDepartmentExists = latestDepartments.some((item) => item._id === current.departmentId);
    if (!selectedDepartmentExists) {
      setSelected({ departmentId: '', courseId: '', academicId: '' });
      setCourses([]);
      setTeachers([]);
      setAcademics([]);
      setSubjects([]);
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
      return;
    }

    const selectedCourseExists = latestCourses.some((item) => item._id === current.courseId);
    if (!selectedCourseExists) {
      setSelected((prev) => ({ ...prev, courseId: '', academicId: '' }));
      setAcademics([]);
      setSubjects([]);
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
      setSelectedFixedSectionId('');
      setFixedSlotMap({});
      setMaxFixedSlots(0);
      return;
    }
    const selectedAcademicExists = latestAcademics.some((item) => item._id === current.academicId);
    if (!selectedAcademicExists) {
      setSelected((prev) => ({ ...prev, academicId: '' }));
      setSections([]);
      setSelectedFixedSectionId('');
      setFixedSlotMap({});
      setMaxFixedSlots(0);
      return;
    }

    const latestSections = await loadSectionsByAcademicId(current.academicId);
    if (latestSections.length) {
      setSelectedFixedSectionId((prev) =>
        prev && latestSections.some((item) => item._id === prev) ? prev : latestSections[0]._id
      );
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
      academicId: ''
    });

    const res = await API.get(`/master/courses/${departmentId}`);
    setCourses(res.data);
    const resTeachers = await API.get(`/master/teachers/${departmentId}`);
    setTeachers(resTeachers.data);
    setAcademics([]);
    setSections([]);
    setSelectedFixedSectionId('');
    setFixedSlotMap({});
    setMaxFixedSlots(0);
  };

  // ================= COURSE CHANGE =================
  const handleCourseChange = async (e) => {
    const courseId = e.target.value;

    setSelected(prev => ({
      ...prev,
      courseId,
      academicId: ''
    }));

    const res1 = await API.get(`/master/academic/${courseId}`);
    setAcademics(res1.data);

    const res2 = await API.get(`/master/subjects/${courseId}`);
    setSubjects(res2.data);
    setSections([]);
    setSelectedFixedSectionId('');
    setFixedSlotMap({});
    setMaxFixedSlots(0);
  };

  // ================= ACADEMIC CHANGE =================
  const handleAcademicChange = async (e) => {
    const academicId = e.target.value;

    setSelected(prev => ({
      ...prev,
      academicId
    }));

    setSections([]);
    setSelectedFixedSectionId('');
    setFixedSlotMap({});
    setMaxFixedSlots(0);
    setFixedSlotMessage('');

    if (academicId) {
      const latestSections = await loadSectionsByAcademicId(academicId);
      if (latestSections.length) {
        setSelectedFixedSectionId(latestSections[0]._id);
      }
    }
  };

  // ================= GENERATE TIMETABLE =================
  const handleGenerate = async () => {
    setDownloadError('');
    const res = await API.post('/timetable/generate', {
      departmentId: selected.departmentId,
      courseId: selected.courseId,
      academicId: selected.academicId
    });

    const { timetables: timetableRows = [], displaySlots: slots } = res.data;

    const formattedRows = timetableRows.map((item) => {
      const data = item?.timetable?.entries || [];
      const formatted = {};

      data.forEach((entry) => {
        if (!formatted[entry.day]) formatted[entry.day] = {};
        formatted[entry.day][entry.period] = {
          subjectId: entry.subjectId,
          teacherId: entry.teacherId,
          isFixed: entry.isFixed,
          fixedLabel: entry.fixedLabel
        };
      });

      return {
        ...item,
        formattedTimetable: formatted
      };
    });

    setGeneratedTimetables(formattedRows);
    setDisplaySlots(slots || []);
  };

  const handleDownload = async (id) => {
    if (!id) return;

    try {
      setDownloadingId(id);
      setDownloadError('');
      const response = await API.get(`/timetable/download/${id}`, {
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
      setDownloadingId('');
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
  const teachingSlots = slotColumns.filter((slot) => !slot.isBreak);
  const canGenerate =
    selected.departmentId &&
    selected.courseId &&
    selected.academicId;
  const fixedSlotCount = Object.keys(fixedSlotMap).filter((key) => fixedSlotMap[key]).length;

  const selectedFixedSection = sections.find((section) => section._id === selectedFixedSectionId);

  useEffect(() => {
    if (!selectedFixedSection) {
      if (sections.length && !selectedFixedSectionId) {
        setSelectedFixedSectionId(sections[0]._id);
      }
      if (!sections.length) {
        setFixedSlotMap({});
        setMaxFixedSlots(0);
      }
      return;
    }

    const map = {};
    const savedSlots = Array.isArray(selectedFixedSection.fixedSlots)
      ? selectedFixedSection.fixedSlots
      : [];
    savedSlots.forEach((slot) => {
      if (!slot?.day || !slot?.period) return;
      map[`${slot.day}-${slot.period}`] = true;
    });
    setFixedSlotMap(map);
    setMaxFixedSlots(savedSlots.length);
    setFixedSlotLabel(savedSlots[0]?.label || 'Extra Activity');
  }, [selectedFixedSectionId, sections]);

  const handleFixedSectionChange = (event) => {
    setSelectedFixedSectionId(event.target.value);
    setFixedSlotMessage('');
  };

  const toggleFixedSlot = (day, period) => {
    if (!selectedFixedSectionId) return;
    const key = `${day}-${period}`;
    setFixedSlotMap((prev) => {
      const currentCount = Object.keys(prev).length;
      if (!prev[key] && maxFixedSlots > 0 && currentCount >= maxFixedSlots) {
        return prev;
      }
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = true;
      }
      return next;
    });
  };

  const clearFixedSlots = () => {
    setFixedSlotMap({});
  };

  const handleMaxFixedSlotsChange = (event) => {
    const value = Number(event.target.value);
    const nextValue = Number.isNaN(value) ? 0 : Math.max(0, Math.floor(value));
    setMaxFixedSlots(nextValue);
    if (nextValue === 0) {
      setFixedSlotMap({});
      return;
    }

    if (nextValue < fixedSlotCount) {
      const orderedKeys = days.flatMap((day) =>
        teachingSlots.map((slot) => `${day}-${slot.period}`)
      );
      const trimmed = {};
      let kept = 0;
      for (const key of orderedKeys) {
        if (!fixedSlotMap[key]) continue;
        trimmed[key] = true;
        kept += 1;
        if (kept >= nextValue) break;
      }
      setFixedSlotMap(trimmed);
    }
  };

  const handleSaveFixedSlots = async () => {
    if (!selectedFixedSectionId) return;
    const trimmedLabel = fixedSlotLabel.trim() || 'Fixed Slot';
    const fixedSlots = Object.keys(fixedSlotMap)
      .filter((key) => fixedSlotMap[key])
      .map((key) => {
        const [day, period] = key.split('-');
        return {
          day,
          period: Number(period),
          label: trimmedLabel
        };
      });

    try {
      setFixedSlotMessage('');
      const res = await API.put(`/master/section/${selectedFixedSectionId}/fixed-slots`, {
        fixedSlots
      });
      const updated = res.data;
      setSections((prev) =>
        prev.map((section) =>
          section._id === selectedFixedSectionId
            ? { ...section, fixedSlots: updated.fixedSlots || fixedSlots }
            : section
        )
      );
      setFixedSlotMessage('Fixed slots saved.');
    } catch (error) {
      setFixedSlotMessage(error.response?.data?.error || 'Failed to save fixed slots.');
    }
  };

  const selectedDepartment = departments.find((dep) => dep._id === selected.departmentId);
  const selectedCourse = courses.find((course) => course._id === selected.courseId);
  const selectedAcademic = academics.find((academic) => academic._id === selected.academicId);

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

          <button
            type="button"
            className="generate-btn"
            onClick={() => setShowFixedSlots((prev) => !prev)}
          >
            {showFixedSlots ? 'Hide Fixed Slots' : `Configure Fixed Slots (${fixedSlotCount})`}
          </button>

          {showFixedSlots && (
            <div className="fixed-slots-panel">
              <div className="fixed-slots-header">
                <div>
                  <h3>Fixed Slots by Section</h3>
                  <p>Pick a section and reserve its extra-activity periods.</p>
                </div>
                <span className="fixed-slot-count">{fixedSlotCount} / {maxFixedSlots || 0}</span>
              </div>

              <div className="fixed-slots-controls">
                <select value={selectedFixedSectionId} onChange={handleFixedSectionChange}>
                  <option value="">Select Section</option>
                  {sections.map((section) => (
                    <option key={section._id} value={section._id}>{section.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  value={maxFixedSlots}
                  onChange={handleMaxFixedSlotsChange}
                  placeholder="Number of fixed slots"
                />
                <input
                  type="text"
                  value={fixedSlotLabel}
                  onChange={(e) => setFixedSlotLabel(e.target.value)}
                  placeholder="Label (e.g., Extra Activity)"
                />
                <button
                  type="button"
                  className="generate-btn fixed-clear-btn"
                  onClick={clearFixedSlots}
                  disabled={!fixedSlotCount}
                >
                  Clear Fixed Slots
                </button>
                <button
                  type="button"
                  className="generate-btn"
                  onClick={handleSaveFixedSlots}
                  disabled={!selectedFixedSectionId}
                >
                  Save Fixed Slots
                </button>
              </div>

              {fixedSlotMessage && (
                <div className="fixed-slot-message">{fixedSlotMessage}</div>
              )}

              <div className="fixed-slots-grid">
                <div className="fixed-slot-row fixed-slot-header">
                  <span className="fixed-slot-day">Day</span>
                  {teachingSlots.map((slot) => (
                    <span key={slot.period} className="fixed-slot-period">
                      {slot.label || `P${slot.period}`}
                    </span>
                  ))}
                </div>
                {days.map((day) => (
                  <div key={day} className="fixed-slot-row">
                    <span className="fixed-slot-day">{day}</span>
                    {teachingSlots.map((slot) => {
                      const key = `${day}-${slot.period}`;
                      const checked = Boolean(fixedSlotMap[key]);
                      const limitReached = maxFixedSlots > 0 && fixedSlotCount >= maxFixedSlots && !checked;
                      const disabled = !selectedFixedSectionId || limitReached;
                      return (
                        <label
                          key={key}
                          className={`fixed-slot-cell ${checked ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleFixedSlot(day, slot.period)}
                            disabled={disabled}
                          />
                        </label>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button className="generate-btn" onClick={handleGenerate} disabled={!canGenerate}>
            Generate Timetable
          </button>

          <button
            className="generate-btn download-btn"
            onClick={() => {
              if (generatedTimetables.length === 1) {
                handleDownload(generatedTimetables[0]?.timetable?._id);
              }
            }}
            disabled={generatedTimetables.length !== 1 || downloadingId === generatedTimetables[0]?.timetable?._id}
          >
            {downloadingId ? 'Downloading...' : '⬇️ Download Timetable (Word)'}
          </button>

        </div>

        {/* ================= TABLE ================= */}
        {generatedTimetables.length > 0 && (
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
          </div>
        )}

        {generatedTimetables.length === 0 && (
          <div className="empty-state" role="status" aria-live="polite">
            <h3>Ready to Generate Timetable</h3>
            <p>Select department, course, and year/term, then click Generate Timetable.</p>
          </div>
        )}

        {downloadError && <div className="download-error">{downloadError}</div>}

        {generatedTimetables.map((item, index) => {
          const formatted = item.formattedTimetable || {};
          const remainingItems = Object.entries(item.remainingBySubject || {})
            .filter(([, remaining]) => remaining > 0)
            .map(([subjectId, remaining]) => ({
              name: subjectMap[subjectId] || 'Unknown subject',
              remaining
            }));

          return (
            <div key={item?.timetable?._id || item?.section?._id || index}>
              <div className="selection-summary">
                <div className="summary-item">
                  <span>Section</span>
                  <strong>{item?.section?.name || '—'}</strong>
                </div>
                <div className="summary-item">
                  <span>Download</span>
                  <button
                    className="generate-btn download-btn"
                    onClick={() => handleDownload(item?.timetable?._id)}
                    disabled={!item?.timetable?._id || downloadingId === item?.timetable?._id}
                  >
                    {downloadingId === item?.timetable?._id ? 'Downloading...' : '⬇️ Download Timetable (Word)'}
                  </button>
                </div>
              </div>

              <div className="table-shell">
                <table className="timetable">
                  <thead>
                    <tr>
                      <th>Day</th>
                      {slotColumns.map((slot, slotIndex) => (
                        <th key={slot.label || slot.period || slotIndex}>
                          <div className="slot-header">
                            <span>{slot.label || `P${slot.period}`}</span>
                            <small>{slot.start} - {slot.end}</small>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {days.map((day) => (
                      <tr key={day}>
                        <td><b>{day}</b></td>
                        {slotColumns.map((slot, slotIndex) => (
                          <td key={`${day}-${slot.label || slot.period || slotIndex}`}>
                            {slot.isBreak
                                  ? 'Lunch'
                                  : (formatted[day]?.[slot.period]?.isFixed
                                    ? (formatted[day]?.[slot.period]?.fixedLabel || 'Fixed Slot')
                                    : (subjectMap[formatted[day]?.[slot.period]?.subjectId] || 'Free Slot'))}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {remainingItems.length > 0 && (
                <div className="remaining-panel">
                  <h3>Remaining Classes (per week)</h3>
                  <div className="remaining-grid">
                    {remainingItems.map((remainingItem) => (
                      <div key={`${item?.section?._id || index}-${remainingItem.name}`} className="remaining-card">
                        <span>{remainingItem.name}</span>
                        <strong>{remainingItem.remaining}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                      Object.values(formatted).forEach((daySlots) => {
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

                      if (!pairs.size) {
                        return (
                          <tr>
                            <td colSpan={2}>No allocation data available</td>
                          </tr>
                        );
                      }

                      return Array.from(pairs.entries()).map(([key, pairItem]) => (
                        <tr key={key}>
                          <td>{pairItem.subjectName}</td>
                          <td>{pairItem.teacherName}</td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

      </div>

    </div>
  );
}

export default GeneratorPage;