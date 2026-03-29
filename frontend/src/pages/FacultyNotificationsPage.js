import React, { useEffect, useState } from 'react';
import API from '../services/api';
import auroraLogo from '../assets/image.png';
import './styles.css';

function FacultyNotificationsPage() {
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [status, setStatus] = useState({ type: '', text: '' });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadTeachers = async () => {
      try {
        const res = await API.get('/timetable/faculty/teachers');
        setTeachers(res.data || []);
      } catch (error) {
        setStatus({ type: 'error', text: 'Failed to load faculty list for notifications.' });
      }
    };

    loadTeachers();
  }, []);

  const loadNotifications = async (teacherId) => {
    if (!teacherId) {
      setIncoming([]);
      setOutgoing([]);
      return;
    }

    try {
      setIsLoading(true);
      setStatus({ type: '', text: '' });
      const res = await API.get(`/timetable/notifications/${teacherId}`);
      setIncoming(res.data?.incoming || []);
      setOutgoing(res.data?.outgoing || []);
    } catch (error) {
      setIncoming([]);
      setOutgoing([]);
      setStatus({ type: 'error', text: error.response?.data?.error || 'Failed to load notifications.' });
    } finally {
      setIsLoading(false);
    }
  };

  const respondToRequest = async (requestId, nextStatus) => {
    try {
      const response = await API.patch(`/timetable/swap-request/${requestId}/respond`, {
        status: nextStatus
      });

      setStatus({ type: 'success', text: response.data?.message || 'Request updated.' });
      await loadNotifications(selectedTeacherId);
    } catch (error) {
      setStatus({ type: 'error', text: error.response?.data?.error || 'Failed to update request.' });
    }
  };

  const statusClassName = (requestStatus) => {
    if (requestStatus === 'approved') return 'status-approved';
    if (requestStatus === 'rejected') return 'status-rejected';
    return 'status-pending';
  };

  return (
    <div className="generator-page">
      <header className="top-bar">
        <div className="brand-text">
          <h2>Aurora University TimeTable Portal</h2>
          <p>Faculty Notifications</p>
        </div>
        <img src={auroraLogo} alt="Aurora University" className="uni-logo right-logo" />
      </header>

      <div className="container">
        <h1>Faculty Notifications</h1>
        <p className="subtitle">Approve or reject timetable swap notifications.</p>

        <div className="card">
          <select
            value={selectedTeacherId}
            onChange={(e) => {
              const teacherId = e.target.value;
              setSelectedTeacherId(teacherId);
              loadNotifications(teacherId);
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

        {status.text && (
          <div className={`upload-status ${status.type === 'success' ? 'success' : 'error'}`}>
            {status.text}
          </div>
        )}

        <div className="faculty-panels-grid">
          <div className="teacher-panel">
            <h3>Incoming Swap Notifications</h3>
            {isLoading ? (
              <p className="hint">Loading notifications...</p>
            ) : incoming.length ? (
              <div className="notifications-list">
                {incoming.map((item) => (
                  <div key={item._id} className="notification-card">
                    <div className="notification-head">
                      <strong>{item.fromTeacherId?.name || 'Faculty'}</strong>
                      <span className={`notification-status ${statusClassName(item.status)}`}>{item.status}</span>
                    </div>
                    <p>
                      {item.day} P{item.period} | Section {item.sectionId?.name || '—'} | {item.subjectId?.name || '—'}
                    </p>
                    {item.reason && <p className="hint">Reason: {item.reason}</p>}
                    {item.status === 'pending' && (
                      <div className="notification-actions">
                        <button className="generate-btn" onClick={() => respondToRequest(item._id, 'approved')}>
                          Approve
                        </button>
                        <button className="generate-btn reject-btn" onClick={() => respondToRequest(item._id, 'rejected')}>
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="hint">No incoming notifications.</p>
            )}
          </div>

          <div className="teacher-panel">
            <h3>Outgoing Swap Requests</h3>
            {isLoading ? (
              <p className="hint">Loading notifications...</p>
            ) : outgoing.length ? (
              <div className="notifications-list">
                {outgoing.map((item) => (
                  <div key={item._id} className="notification-card">
                    <div className="notification-head">
                      <strong>To: {item.toTeacherId?.name || 'Faculty'}</strong>
                      <span className={`notification-status ${statusClassName(item.status)}`}>{item.status}</span>
                    </div>
                    <p>
                      {item.day} P{item.period} | Section {item.sectionId?.name || '—'} | {item.subjectId?.name || '—'}
                    </p>
                    {item.reason && <p className="hint">Reason: {item.reason}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="hint">No outgoing swap requests.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default FacultyNotificationsPage;
