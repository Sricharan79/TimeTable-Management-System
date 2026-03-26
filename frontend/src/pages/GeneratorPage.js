import React, { useEffect, useState } from 'react';
import API from '../services/api';
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

  // ================= SUBJECT NAME MAP =================
  const subjectMap = {};
  subjects.forEach(s => {
    subjectMap[s._id] = s.name;
  });

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const periods = [1, 2, 3, 4, 5];

  return (
    <div className="container">

      <h1>🎓 TimeTable Generator</h1>

      <div className="card">

        {/* Department */}
        <select onChange={handleDepartmentChange}>
          <option>Select Department</option>
          {departments.map(dep => (
            <option key={dep._id} value={dep._id}>{dep.name}</option>
          ))}
        </select>

        {/* Course */}
        <select onChange={handleCourseChange}>
          <option>Select Course</option>
          {courses.map(c => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </select>

        {/* Academic */}
        <select onChange={handleAcademicChange}>
          <option>Select Year / Semester</option>
          {academics.map(a => (
            <option key={a._id} value={a._id}>
              Year {a.year} - Sem {a.semester}
            </option>
          ))}
        </select>

        {/* Section */}
        <select onChange={(e) =>
          setSelected(prev => ({ ...prev, sectionId: e.target.value }))
        }>
          <option>Select Section</option>
          {sections.map(s => (
            <option key={s._id} value={s._id}>{s.name}</option>
          ))}
        </select>

        <button onClick={handleGenerate}>
          🚀 Generate Timetable
        </button>

      </div>

      {/* ================= TABLE ================= */}
      {Object.keys(timetable).length > 0 && (
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
      )}

    </div>
  );
}

export default GeneratorPage;