import React, { useEffect, useMemo, useState } from 'react';
import API from '../services/api';
import auroraLogo from '../assets/image.png';
import './styles.css';

const DAYS_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const dedupeDepartmentsByName = (items = []) => {
  const seen = new Set();
  return items.filter((department) => {
    const key = String(department?.name || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const slotLabel = (period) => `P${period}`;

function FacultyDashboard() {
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [facultyEntries, setFacultyEntries] = useState([]);

  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [academics, setAcademics] = useState([]);
  const [sections, setSections] = useState([]);

  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedAcademicId, setSelectedAcademicId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');

  const [sectionTimetable, setSectionTimetable] = useState(null);
  const [sectionSlots, setSectionSlots] = useState([]);

  const [swapTargetTeacherId, setSwapTargetTeacherId] = useState('');
  const [swapSelection, setSwapSelection] = useState('');
  const [swapReason, setSwapReason] = useState('');
  const [swapMessage, setSwapMessage] = useState({ type: '', text: '' });

  const [isLoadingFaculty, setIsLoadingFaculty] = useState(false);
  const [isLoadingSection, setIsLoadingSection] = useState(false);
  const [isSendingSwap, setIsSendingSwap] = useState(false);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [teachersRes, departmentsRes] = await Promise.all([
          API.get('/timetable/faculty/teachers'),
          API.get('/master/departments')
        ]);

        setTeachers(teachersRes.data || []);
        setDepartments(dedupeDepartmentsByName(departmentsRes.data || []));
      } catch (error) {
        setSwapMessage({ type: 'error', text: 'Failed to load faculty dashboard data.' });
      }
    };

    loadInitialData();
  }, []);

  const loadFacultyTimetable = async (teacherId) => {
    if (!teacherId) {
      setFacultyEntries([]);
      return;
    }

    try {
      setIsLoadingFaculty(true);
      const res = await API.get(`/timetable/faculty/${teacherId}/timetable`);
      setFacultyEntries(res.data?.entries || []);
      setSwapSelection('');
      setSwapTargetTeacherId('');
      setSwapReason('');
    } catch (error) {
      setFacultyEntries([]);
      setSwapMessage({ type: 'error', text: error.response?.data?.error || 'Failed to load faculty timetable.' });
    } finally {
      setIsLoadingFaculty(false);
    }
  };

  const handleDepartmentChange = async (departmentId) => {
    setSelectedDepartmentId(departmentId);
    setSelectedCourseId('');
    setSelectedAcademicId('');
    setSelectedSectionId('');
    setSectionTimetable(null);
    setSectionSlots([]);
    setCourses([]);
    setAcademics([]);
    setSections([]);

    if (!departmentId) return;

    try {
      const res = await API.get(`/master/courses/${departmentId}`);
      setCourses(res.data || []);
    } catch (error) {
      setSwapMessage({ type: 'error', text: 'Failed to load programs for selected department.' });
    }
  };

  const handleCourseChange = async (courseId) => {
    setSelectedCourseId(courseId);
    setSelectedAcademicId('');
    setSelectedSectionId('');
    setSectionTimetable(null);
    setSectionSlots([]);
    setAcademics([]);
    setSections([]);

    if (!courseId) return;

    try {
      const res = await API.get(`/master/academic/${courseId}`);
      setAcademics(res.data || []);
    } catch (error) {
      setSwapMessage({ type: 'error', text: 'Failed to load year/term values.' });
    }
  };

  const handleAcademicChange = async (academicId) => {
    setSelectedAcademicId(academicId);
    setSelectedSectionId('');
    setSectionTimetable(null);
    setSectionSlots([]);
    setSections([]);

    if (!academicId) return;

    try {
      const res = await API.get(`/master/sections/${academicId}`);
      setSections(res.data || []);
    } catch (error) {
      setSwapMessage({ type: 'error', text: 'Failed to load sections.' });
    }
  };

  const handleLoadSectionTimetable = async () => {
    if (!selectedSectionId) return;

    try {
      setIsLoadingSection(true);
      const res = await API.get(`/timetable/section/${selectedSectionId}/latest`);
      setSectionTimetable(res.data?.timetable || null);
      setSectionSlots(res.data?.displaySlots || []);
    } catch (error) {
      setSectionTimetable(null);
      setSectionSlots([]);
      setSwapMessage({
        type: 'error',
        text: error.response?.data?.error || 'No timetable found for this section yet.'
      });
    } finally {
      setIsLoadingSection(false);
    }
  };

  const facultyEntriesSorted = useMemo(() => {
    return [...facultyEntries].sort((a, b) => {
      const dayDiff = DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day);
      if (dayDiff !== 0) return dayDiff;
      return Number(a.period) - Number(b.period);
    });
  }, [facultyEntries]);

  const selectedTeacherName = useMemo(
    () => teachers.find((teacher) => teacher._id === selectedTeacherId)?.name || '',
    [teachers, selectedTeacherId]
  );

  const swapFromOptions = facultyEntriesSorted.map((entry) => ({
    key: `${entry.sectionId}-${entry.day}-${entry.period}`,
    label: `${entry.day} ${entry.periodLabel || slotLabel(entry.period)} - ${entry.subjectName} (${entry.sectionName})`,
    value: JSON.stringify({
      sectionId: entry.sectionId,
      day: entry.day,
      period: entry.period,
      subjectName: entry.subjectName,
      sectionName: entry.sectionName
    })
  }));

  const teacherOptionsForSwap = teachers.filter((teacher) => teacher._id !== selectedTeacherId);

  const sectionEntryMap = useMemo(() => {
    const map = new Map();
    if (!sectionTimetable?.entries) return map;

    sectionTimetable.entries.forEach((entry) => {
      map.set(`${entry.day}-${entry.period}`, {
        subjectName: entry.subjectId?.name || '—',
        teacherName: entry.teacherId?.name || '—'
      });
    });

    return map;
  }, [sectionTimetable]);

  const sendSwapRequest = async () => {
    if (!selectedTeacherId || !swapTargetTeacherId || !swapSelection) {
      setSwapMessage({ type: 'error', text: 'Select faculty, slot, and target faculty for swap.' });
      return;
    }

    const payload = JSON.parse(swapSelection);

    try {
      setIsSendingSwap(true);
      setSwapMessage({ type: '', text: '' });

      const res = await API.post('/timetable/swap-request', {
        fromTeacherId: selectedTeacherId,
        toTeacherId: swapTargetTeacherId,
        sectionId: payload.sectionId,
        day: payload.day,
        period: Number(payload.period),
        reason: swapReason
      });

      setSwapMessage({ type: 'success', text: res.data?.message || 'Swap request sent successfully.' });
      setSwapSelection('');
      setSwapTargetTeacherId('');
      setSwapReason('');
    } catch (error) {
      setSwapMessage({ type: 'error', text: error.response?.data?.error || 'Failed to send swap request.' });
    } finally {
      setIsSendingSwap(false);
    }
  };

  const sectionSlotsToUse = sectionSlots.length
    ? sectionSlots
    : [
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

  return (
    <div className="generator-page">
      <header className="top-bar">
        <div className="brand-text">
          <h2>Aurora University TimeTable Portal</h2>
          <p>Faculty Dashboard</p>
        </div>
        <img src={auroraLogo} alt="Aurora University" className="uni-logo right-logo" />
      </header>

      <div className="container">
        <h1>Faculty Dashboard</h1>
        <p className="subtitle">View individual faculty timetable, section-wise timetable, and send exchange requests.</p>

        <div className="card">
          <select
            value={selectedTeacherId}
            onChange={(e) => {
              const teacherId = e.target.value;
              setSelectedTeacherId(teacherId);
              loadFacultyTimetable(teacherId);
            }}
          >
            <option value="">Select Faculty</option>
            {teachers.map((teacher) => (
              <option key={teacher._id} value={teacher._id}>
                {teacher.name}
              </option>
            ))}
          </select>
        </div>

        <div className="faculty-panels-grid">
          <div className="teacher-panel">
            <h3>Individual Faculty Timetable</h3>
            {selectedTeacherName && <p className="subtitle">Faculty: {selectedTeacherName}</p>}
            {isLoadingFaculty ? (
              <p className="hint">Loading faculty timetable...</p>
            ) : facultyEntriesSorted.length ? (
              <table className="teacher-table">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Period</th>
                    <th>Subject</th>
                    <th>Section</th>
                  </tr>
                </thead>
                <tbody>
                  {facultyEntriesSorted.map((entry, index) => (
                    <tr key={`${entry.timetableId}-${entry.day}-${entry.period}-${index}`}>
                      <td>{entry.day}</td>
                      <td>{entry.periodLabel || slotLabel(entry.period)}</td>
                      <td>{entry.subjectName}</td>
                      <td>{entry.sectionName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="hint">Select a faculty member to view timetable.</p>
            )}
          </div>

          <div className="teacher-panel">
            <h3>Exchange / Swap Request</h3>
            <p className="hint">Request another faculty member to take your selected class slot.</p>

            <div className="admin-grid">
              <div className="admin-card">
                <h4>Your Class Slot</h4>
                <select value={swapSelection} onChange={(e) => setSwapSelection(e.target.value)}>
                  <option value="">Select your class period</option>
                  {swapFromOptions.map((option) => (
                    <option key={option.key} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-card">
                <h4>Swap With Faculty</h4>
                <select value={swapTargetTeacherId} onChange={(e) => setSwapTargetTeacherId(e.target.value)}>
                  <option value="">Select target faculty</option>
                  {teacherOptionsForSwap.map((teacher) => (
                    <option key={teacher._id} value={teacher._id}>
                      {teacher.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-card">
                <h4>Reason</h4>
                <input
                  type="text"
                  value={swapReason}
                  onChange={(e) => setSwapReason(e.target.value)}
                  placeholder="Optional reason"
                />
                <button className="generate-btn" onClick={sendSwapRequest} disabled={isSendingSwap || !selectedTeacherId}>
                  {isSendingSwap ? 'Sending...' : 'Send Swap Request'}
                </button>
              </div>
            </div>

            {swapMessage.text && (
              <div className={`upload-status ${swapMessage.type === 'success' ? 'success' : 'error'}`}>
                {swapMessage.text}
              </div>
            )}
          </div>
        </div>

        <div className="teacher-panel section-view-panel">
          <h3>Section-Wise Timetable</h3>

          <div className="card section-selector-card">
            <select value={selectedDepartmentId} onChange={(e) => handleDepartmentChange(e.target.value)}>
              <option value="">Select Department</option>
              {departments.map((department) => (
                <option key={department._id} value={department._id}>
                  {department.name}
                </option>
              ))}
            </select>

            <select value={selectedCourseId} onChange={(e) => handleCourseChange(e.target.value)} disabled={!selectedDepartmentId}>
              <option value="">Select Program</option>
              {courses.map((course) => (
                <option key={course._id} value={course._id}>
                  {course.name}
                </option>
              ))}
            </select>

            <select value={selectedAcademicId} onChange={(e) => handleAcademicChange(e.target.value)} disabled={!selectedCourseId}>
              <option value="">Select Year / Term</option>
              {academics.map((academic) => (
                <option key={academic._id} value={academic._id}>
                  Year {academic.year} - Term {academic.semester}
                </option>
              ))}
            </select>

            <select value={selectedSectionId} onChange={(e) => setSelectedSectionId(e.target.value)} disabled={!selectedAcademicId}>
              <option value="">Select Section</option>
              {sections.map((section) => (
                <option key={section._id} value={section._id}>
                  {section.name}
                </option>
              ))}
            </select>

            <button className="generate-btn" onClick={handleLoadSectionTimetable} disabled={!selectedSectionId || isLoadingSection}>
              {isLoadingSection ? 'Loading...' : 'View Section Timetable'}
            </button>
          </div>

          {sectionTimetable?.entries?.length ? (
            <div className="table-shell">
              <table className="timetable">
                <thead>
                  <tr>
                    <th>Day</th>
                    {sectionSlotsToUse.map((slot, index) => (
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
                  {DAYS_ORDER.map((day) => (
                    <tr key={day}>
                      <td><b>{day}</b></td>
                      {sectionSlotsToUse.map((slot, index) => {
                        if (slot.isBreak) {
                          return <td key={`${day}-break-${index}`}>Lunch</td>;
                        }

                        const item = sectionEntryMap.get(`${day}-${slot.period}`);
                        return (
                          <td key={`${day}-${slot.period}`}>
                            <div>{item?.subjectName || '—'}</div>
                            <small>{item?.teacherName || '—'}</small>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="hint">Select section filters and click View Section Timetable.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default FacultyDashboard;
