import React, { useEffect, useMemo, useState } from 'react';
import API from '../services/api';
import {
  MASTER_DATA_SYNC_KEY,
  MASTER_DATA_UPDATED_EVENT,
  notifyMasterDataChanged
} from '../services/dataSync';
import auroraLogo from '../assets/image.png';
import './styles.css';

const sortByName = (items = []) =>
  [...items].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));

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
  if (typeof value === 'object') {
    return value._id || '';
  }
  return value;
};

function ManageDataPage() {
  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);

  const [status, setStatus] = useState({ type: '', message: '' });

  const [departmentEdit, setDepartmentEdit] = useState({ id: '', name: '' });
  const [courseEdit, setCourseEdit] = useState({ id: '', name: '', departmentId: '' });
  const [subjectEdit, setSubjectEdit] = useState({ id: '', name: '', courseId: '' });
  const [teacherEdit, setTeacherEdit] = useState({ id: '', name: '', departmentId: '', subjectIds: [] });

  const getErrorMessage = (error, fallback) => error.response?.data?.error || fallback;

  const loadAllData = async () => {
    const [departmentsRes, coursesRes, teachersRes] = await Promise.all([
      API.get('/master/departments'),
      API.get('/master/courses'),
      API.get('/master/teachers')
    ]);

    const allCourses = coursesRes.data || [];
    const subjectsByCourse = await Promise.all(
      allCourses.map((course) => API.get(`/master/subjects/${course._id}`))
    );

    const mergedSubjects = subjectsByCourse.flatMap((response) => response.data || []);
    const uniqueSubjects = Array.from(new Map(mergedSubjects.map((item) => [item._id, item])).values());

    setDepartments(sortByName(dedupeDepartmentsByName(departmentsRes.data || [])));
    setCourses(sortByName(allCourses));
    setSubjects(sortByName(uniqueSubjects));
    setTeachers(sortByName(teachersRes.data || []));
  };

  useEffect(() => {
    loadAllData().catch((error) => {
      setStatus({ type: 'error', message: getErrorMessage(error, 'Failed to load data.') });
    });
  }, []);

  useEffect(() => {
    const refresh = () => {
      loadAllData().catch((error) => {
        setStatus({ type: 'error', message: getErrorMessage(error, 'Failed to refresh data.') });
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };

    const handleStorage = (event) => {
      if (event.key === MASTER_DATA_SYNC_KEY) {
        refresh();
      }
    };

    window.addEventListener(MASTER_DATA_UPDATED_EVENT, refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener(MASTER_DATA_UPDATED_EVENT, refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const departmentMap = useMemo(() => {
    const map = {};
    departments.forEach((item) => {
      map[item._id] = item.name;
    });
    return map;
  }, [departments]);

  const courseMap = useMemo(() => {
    const map = {};
    courses.forEach((item) => {
      map[item._id] = item.name;
    });
    return map;
  }, [courses]);

  const subjectMap = useMemo(() => {
    const map = {};
    subjects.forEach((item) => {
      map[item._id] = item.name;
    });
    return map;
  }, [subjects]);

  const handleDepartmentEditClick = (item) => {
    setDepartmentEdit({ id: item._id, name: item.name || '' });
  };

  const handleDepartmentUpdate = async () => {
    if (!departmentEdit.id || !departmentEdit.name.trim()) return;

    try {
      await API.put(`/master/department/${departmentEdit.id}`, { name: departmentEdit.name.trim() });
      await loadAllData();
      notifyMasterDataChanged();
      setDepartmentEdit({ id: '', name: '' });
      setStatus({ type: 'success', message: 'School/Department updated.' });
    } catch (error) {
      setStatus({ type: 'error', message: getErrorMessage(error, 'Failed to update school/department.') });
    }
  };

  const handleDepartmentDelete = async (item) => {
    if (!window.confirm(`Delete school/department "${item.name}"?`)) return;

    try {
      await API.delete(`/master/department/${item._id}`);
      await loadAllData();
      notifyMasterDataChanged();
      if (departmentEdit.id === item._id) {
        setDepartmentEdit({ id: '', name: '' });
      }
      setStatus({ type: 'success', message: 'School/Department deleted.' });
    } catch (error) {
      setStatus({ type: 'error', message: getErrorMessage(error, 'Failed to delete school/department.') });
    }
  };

  const handleCourseEditClick = (item) => {
    setCourseEdit({
      id: item._id,
      name: item.name || '',
      departmentId: getEntityId(item.departmentId)
    });
  };

  const handleCourseUpdate = async () => {
    if (!courseEdit.id || !courseEdit.name.trim() || !courseEdit.departmentId) return;

    try {
      await API.put(`/master/course/${courseEdit.id}`, {
        name: courseEdit.name.trim(),
        departmentId: courseEdit.departmentId
      });
      await loadAllData();
      notifyMasterDataChanged();
      setCourseEdit({ id: '', name: '', departmentId: '' });
      setStatus({ type: 'success', message: 'Program updated.' });
    } catch (error) {
      setStatus({ type: 'error', message: getErrorMessage(error, 'Failed to update program.') });
    }
  };

  const handleCourseDelete = async (item) => {
    if (!window.confirm(`Delete program "${item.name}"?`)) return;

    try {
      await API.delete(`/master/course/${item._id}`);
      await loadAllData();
      notifyMasterDataChanged();
      if (courseEdit.id === item._id) {
        setCourseEdit({ id: '', name: '', departmentId: '' });
      }
      setStatus({ type: 'success', message: 'Program deleted.' });
    } catch (error) {
      setStatus({ type: 'error', message: getErrorMessage(error, 'Failed to delete program.') });
    }
  };

  const handleSubjectEditClick = (item) => {
    setSubjectEdit({
      id: item._id,
      name: item.name || '',
      courseId: getEntityId(item.courseId)
    });
  };

  const handleSubjectUpdate = async () => {
    if (!subjectEdit.id || !subjectEdit.name.trim() || !subjectEdit.courseId) return;

    try {
      await API.put(`/master/subject/${subjectEdit.id}`, {
        name: subjectEdit.name.trim(),
        courseId: subjectEdit.courseId
      });
      await loadAllData();
      notifyMasterDataChanged();
      setSubjectEdit({ id: '', name: '', courseId: '' });
      setStatus({ type: 'success', message: 'Specialization/Subject updated.' });
    } catch (error) {
      setStatus({ type: 'error', message: getErrorMessage(error, 'Failed to update specialization/subject.') });
    }
  };

  const handleSubjectDelete = async (item) => {
    if (!window.confirm(`Delete specialization/subject "${item.name}"?`)) return;

    try {
      await API.delete(`/master/subject/${item._id}`);
      await loadAllData();
      notifyMasterDataChanged();
      if (subjectEdit.id === item._id) {
        setSubjectEdit({ id: '', name: '', courseId: '' });
      }
      setStatus({ type: 'success', message: 'Specialization/Subject deleted.' });
    } catch (error) {
      setStatus({ type: 'error', message: getErrorMessage(error, 'Failed to delete specialization/subject.') });
    }
  };

  const handleTeacherEditClick = (item) => {
    setTeacherEdit({
      id: item._id,
      name: item.name || '',
      departmentId: getEntityId(item.departmentId),
      subjectIds: (item.subjects || []).map((subject) => subject._id || subject)
    });
  };

  const handleTeacherUpdate = async () => {
    if (!teacherEdit.id || !teacherEdit.name.trim() || !teacherEdit.departmentId) return;

    try {
      await API.put(`/master/teacher/${teacherEdit.id}`, {
        name: teacherEdit.name.trim(),
        departmentId: teacherEdit.departmentId,
        subjects: teacherEdit.subjectIds
      });
      await loadAllData();
      notifyMasterDataChanged();
      setTeacherEdit({ id: '', name: '', departmentId: '', subjectIds: [] });
      setStatus({ type: 'success', message: 'Teacher updated.' });
    } catch (error) {
      setStatus({ type: 'error', message: getErrorMessage(error, 'Failed to update teacher.') });
    }
  };

  const handleTeacherDelete = async (item) => {
    if (!window.confirm(`Delete teacher "${item.name}"?`)) return;

    try {
      await API.delete(`/master/teacher/${item._id}`);
      await loadAllData();
      notifyMasterDataChanged();
      if (teacherEdit.id === item._id) {
        setTeacherEdit({ id: '', name: '', departmentId: '', subjectIds: [] });
      }
      setStatus({ type: 'success', message: 'Teacher deleted.' });
    } catch (error) {
      setStatus({ type: 'error', message: getErrorMessage(error, 'Failed to delete teacher.') });
    }
  };

  return (
    <div className="generator-page">
      <header className="top-bar">
        <div className="brand-text">
          <h2>Aurora University TimeTable Portal</h2>
          <p>Manage Master Data</p>
        </div>
        <img src={auroraLogo} alt="Aurora University" className="uni-logo right-logo" />
      </header>

      <div className="container">
        <h1>Manage Data</h1>
        <p className="subtitle">
          Edit or delete School/Department, Program, Specialization/Subject, and Teacher data. Dropdowns auto-update in Timetable Generator.
        </p>

        <div className="manage-layout">
          <div className="manage-box">
            <h4>School / Department</h4>
            <div className="manage-edit-form">
              <input
                type="text"
                placeholder="Department name"
                value={departmentEdit.name}
                onChange={(e) => setDepartmentEdit((prev) => ({ ...prev, name: e.target.value }))}
              />
              <div className="action-cell">
                <button className="action-btn edit-btn" onClick={handleDepartmentUpdate} disabled={!departmentEdit.id}>
                  Update
                </button>
                <button
                  className="action-btn delete-btn"
                  onClick={() => setDepartmentEdit({ id: '', name: '' })}
                  disabled={!departmentEdit.id}
                >
                  Cancel
                </button>
              </div>
            </div>
            <table className="manage-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((item) => (
                  <tr key={item._id}>
                    <td>{item.name}</td>
                    <td className="action-cell">
                      <button className="action-btn edit-btn" onClick={() => handleDepartmentEditClick(item)}>Edit</button>
                      <button className="action-btn delete-btn" onClick={() => handleDepartmentDelete(item)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="manage-box">
            <h4>Program</h4>
            <div className="manage-edit-form">
              <select
                value={courseEdit.departmentId}
                onChange={(e) => setCourseEdit((prev) => ({ ...prev, departmentId: e.target.value }))}
              >
                <option value="">Select Department</option>
                {departments.map((item) => (
                  <option key={item._id} value={item._id}>{item.name}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Program name"
                value={courseEdit.name}
                onChange={(e) => setCourseEdit((prev) => ({ ...prev, name: e.target.value }))}
              />
              <div className="action-cell">
                <button className="action-btn edit-btn" onClick={handleCourseUpdate} disabled={!courseEdit.id}>
                  Update
                </button>
                <button
                  className="action-btn delete-btn"
                  onClick={() => setCourseEdit({ id: '', name: '', departmentId: '' })}
                  disabled={!courseEdit.id}
                >
                  Cancel
                </button>
              </div>
            </div>
            <table className="manage-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((item) => (
                  <tr key={item._id}>
                    <td>{item.name}</td>
                    <td>{departmentMap[getEntityId(item.departmentId)] || '-'}</td>
                    <td className="action-cell">
                      <button className="action-btn edit-btn" onClick={() => handleCourseEditClick(item)}>Edit</button>
                      <button className="action-btn delete-btn" onClick={() => handleCourseDelete(item)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="manage-box">
            <h4>Specialization / Subject</h4>
            <div className="manage-edit-form">
              <select
                value={subjectEdit.courseId}
                onChange={(e) => setSubjectEdit((prev) => ({ ...prev, courseId: e.target.value }))}
              >
                <option value="">Select Program</option>
                {courses.map((item) => (
                  <option key={item._id} value={item._id}>{item.name}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Specialization / Subject name"
                value={subjectEdit.name}
                onChange={(e) => setSubjectEdit((prev) => ({ ...prev, name: e.target.value }))}
              />
              <div className="action-cell">
                <button className="action-btn edit-btn" onClick={handleSubjectUpdate} disabled={!subjectEdit.id}>
                  Update
                </button>
                <button
                  className="action-btn delete-btn"
                  onClick={() => setSubjectEdit({ id: '', name: '', courseId: '' })}
                  disabled={!subjectEdit.id}
                >
                  Cancel
                </button>
              </div>
            </div>
            <table className="manage-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Program</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((item) => (
                  <tr key={item._id}>
                    <td>{item.name}</td>
                    <td>{courseMap[getEntityId(item.courseId)] || '-'}</td>
                    <td className="action-cell">
                      <button className="action-btn edit-btn" onClick={() => handleSubjectEditClick(item)}>Edit</button>
                      <button className="action-btn delete-btn" onClick={() => handleSubjectDelete(item)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="manage-box">
            <h4>Teacher</h4>
            <div className="manage-edit-form">
              <select
                value={teacherEdit.departmentId}
                onChange={(e) => setTeacherEdit((prev) => ({ ...prev, departmentId: e.target.value }))}
              >
                <option value="">Select Department</option>
                {departments.map((item) => (
                  <option key={item._id} value={item._id}>{item.name}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Teacher name"
                value={teacherEdit.name}
                onChange={(e) => setTeacherEdit((prev) => ({ ...prev, name: e.target.value }))}
              />
              <div className="admin-subjects">
                {subjects.map((subject) => (
                  <label key={subject._id} className="checkbox">
                    <input
                      type="checkbox"
                      checked={teacherEdit.subjectIds.includes(subject._id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setTeacherEdit((prev) => ({ ...prev, subjectIds: [...prev.subjectIds, subject._id] }));
                        } else {
                          setTeacherEdit((prev) => ({
                            ...prev,
                            subjectIds: prev.subjectIds.filter((id) => id !== subject._id)
                          }));
                        }
                      }}
                    />
                    {subject.name}
                  </label>
                ))}
              </div>
              <div className="action-cell">
                <button className="action-btn edit-btn" onClick={handleTeacherUpdate} disabled={!teacherEdit.id}>
                  Update
                </button>
                <button
                  className="action-btn delete-btn"
                  onClick={() => setTeacherEdit({ id: '', name: '', departmentId: '', subjectIds: [] })}
                  disabled={!teacherEdit.id}
                >
                  Cancel
                </button>
              </div>
            </div>
            <table className="manage-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Specializations / Subjects</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((item) => (
                  <tr key={item._id}>
                    <td>{item.name}</td>
                    <td>{departmentMap[getEntityId(item.departmentId)] || '-'}</td>
                    <td>{(item.subjects || []).map((subject) => subjectMap[subject._id || subject] || '-').join(', ') || '-'}</td>
                    <td className="action-cell">
                      <button className="action-btn edit-btn" onClick={() => handleTeacherEditClick(item)}>Edit</button>
                      <button className="action-btn delete-btn" onClick={() => handleTeacherDelete(item)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {status.message && (
          <div className={`admin-status ${status.type}`}>
            {status.message}
          </div>
        )}
      </div>
    </div>
  );
}

export default ManageDataPage;
