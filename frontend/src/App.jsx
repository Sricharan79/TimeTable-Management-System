import React, { useMemo, useState } from 'react';

const defaultDays = [
  { id: 'mon', label: 'Monday', enabled: true },
  { id: 'tue', label: 'Tuesday', enabled: true },
  { id: 'wed', label: 'Wednesday', enabled: true },
  { id: 'thu', label: 'Thursday', enabled: true },
  { id: 'fri', label: 'Friday', enabled: true },
  { id: 'sat', label: 'Saturday', enabled: false },
];

const emptySubjectRow = (id) => ({ id, name: '', faculty: '', sessions: 1 });

function parseTimeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function buildSlots({
  startTime,
  endTime,
  slotMinutes,
  periodsBeforeLunch,
  lunchMinutes,
  periodsAfterLunch,
}) {
  const slots = [];
  let cursor = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);

  for (let i = 0; i < periodsBeforeLunch; i += 1) {
    const from = cursor;
    const to = cursor + slotMinutes;
    if (to > endMinutes) break;
    slots.push({
      id: `p-${i + 1}`,
      label: `${minutesToTime(from)} - ${minutesToTime(to)}`,
      isLunch: false,
    });
    cursor = to;
  }

  if (cursor >= endMinutes) {
    return slots;
  }

  const lunchFrom = cursor;
  const lunchTo = cursor + lunchMinutes;
  slots.push({
    id: 'lunch',
    label: `${minutesToTime(lunchFrom)} - ${minutesToTime(lunchTo)} (Lunch)`,
    isLunch: true,
  });
  cursor = lunchTo;

  if (cursor >= endMinutes) {
    return slots;
  }

  for (let i = 0; i < periodsAfterLunch; i += 1) {
    const from = cursor;
    const to = cursor + slotMinutes;
    if (to > endMinutes) break;
    slots.push({
      id: `ap-${i + 1}`,
      label: `${minutesToTime(from)} - ${minutesToTime(to)}`,
      isLunch: false,
    });
    cursor = to;
  }

  return slots;
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateGrid({ activeDays, slots, subjects, avoidConsecutive, maxPerDay }) {
  const teachingSlotsPerDay = slots.filter((s) => !s.isLunch).length;
  const totalTeachingSlots = teachingSlotsPerDay * activeDays.length;

  const requiredBySubject = subjects.reduce((acc, subject) => {
    acc[subject.name] = (acc[subject.name] || 0) + subject.sessions;
    return acc;
  }, {});

  const expandedSubjects = subjects.flatMap((s) => Array.from({ length: s.sessions }, () => s.name));

  let warning = '';

  let pool = shuffle(expandedSubjects);
  if (pool.length > totalTeachingSlots) {
    pool = pool.slice(0, totalTeachingSlots);
    warning =
      'Some sessions could not be scheduled because there are more sessions than available slots.';
  }

  const grid = activeDays.map(() => slots.map((slot) => (slot.isLunch ? 'LUNCH' : 'Free Slot')));

  for (let d = 0; d < activeDays.length; d += 1) {
    for (let sIndex = 0; sIndex < slots.length; sIndex += 1) {
      const slot = slots[sIndex];
      if (slot.isLunch) continue;
      grid[d][sIndex] = pool.pop();
    }
  }

  if (avoidConsecutive || maxPerDay > 0) {
    for (let d = 0; d < activeDays.length; d += 1) {
      const dayRow = grid[d];
      const perSubjectCount = {};
      for (let sIndex = 0; sIndex < slots.length; sIndex += 1) {
        const slot = slots[sIndex];
        if (slot.isLunch) continue;
        const current = dayRow[sIndex];
        perSubjectCount[current] = (perSubjectCount[current] || 0) + 1;

        const prevIndex = sIndex - 1;
        if (avoidConsecutive && prevIndex >= 0 && !slots[prevIndex].isLunch) {
          const prev = dayRow[prevIndex];
          if (prev === current) {
            let swapped = false;
            for (let k = sIndex + 1; k < slots.length; k += 1) {
              if (slots[k].isLunch) continue;
              const candidate = dayRow[k];
              if (candidate !== current) {
                [dayRow[sIndex], dayRow[k]] = [dayRow[k], dayRow[sIndex]];
                swapped = true;
                break;
              }
            }
            if (!swapped) {
              warning =
                'Timetable generated, but some rules (like no back-to-back classes) could not be fully satisfied.';
            }
          }
        }
      }
      if (maxPerDay > 0) {
        Object.entries(perSubjectCount).forEach(([subject, count]) => {
          if (count > maxPerDay) {
            if (!warning) {
              warning =
                'Timetable generated, but some rules (like maximum classes per day) could not be fully satisfied.';
            }
          }
        });
      }
    }
  }

  const scheduledBySubject = {};
  for (let d = 0; d < activeDays.length; d += 1) {
    for (let sIndex = 0; sIndex < slots.length; sIndex += 1) {
      const slot = slots[sIndex];
      if (slot.isLunch) continue;
      const value = grid[d][sIndex];
      if (!value || value === 'Free Slot') continue;
      scheduledBySubject[value] = (scheduledBySubject[value] || 0) + 1;
    }
  }

  const remainingBySubject = {};
  Object.entries(requiredBySubject).forEach(([subjectName, required]) => {
    const scheduled = scheduledBySubject[subjectName] || 0;
    const remaining = required - scheduled;
    if (remaining > 0) {
      remainingBySubject[subjectName] = remaining;
    }
  });

  return { grid, message: warning, remainingBySubject };
}

export default function App() {
  const [days, setDays] = useState(defaultDays);
  const [startTime, setStartTime] = useState('09:30');
  const [endTime, setEndTime] = useState('16:10');
  const [slotMinutes, setSlotMinutes] = useState(50);
  const [periodsBeforeLunch, setPeriodsBeforeLunch] = useState(3);
  const [periodsAfterLunch, setPeriodsAfterLunch] = useState(3);
  const [lunchMinutes, setLunchMinutes] = useState(40);
  const [subjects, setSubjects] = useState([emptySubjectRow(1), emptySubjectRow(2), emptySubjectRow(3)]);
  const [avoidConsecutive, setAvoidConsecutive] = useState(true);
  const [maxPerDay, setMaxPerDay] = useState(0);
  const [grid, setGrid] = useState(null);
  const [infoMessage, setInfoMessage] = useState('');
  const [remaining, setRemaining] = useState(null);

  const activeDays = useMemo(() => days.filter((d) => d.enabled), [days]);

  const slots = useMemo(
    () =>
      buildSlots({
        startTime,
        endTime,
        slotMinutes: Number(slotMinutes) || 50,
        periodsBeforeLunch: Number(periodsBeforeLunch) || 0,
        lunchMinutes: Number(lunchMinutes) || 30,
        periodsAfterLunch: Number(periodsAfterLunch) || 0,
      }),
    [startTime, endTime, slotMinutes, periodsBeforeLunch, lunchMinutes, periodsAfterLunch],
  );

  const teachingSlotsPerDay = slots.filter((s) => !s.isLunch).length;
  const totalTeachingSlots = teachingSlotsPerDay * activeDays.length;

  const totalRequestedSessions = subjects
    .filter((s) => s.name.trim() && Number(s.sessions) > 0)
    .reduce((sum, s) => sum + Number(s.sessions), 0);

  const facultyBySubject = useMemo(() => {
    const map = {};
    subjects.forEach((s) => {
      if (s.name.trim()) {
        map[s.name] = s.faculty || '';
      }
    });
    return map;
  }, [subjects]);

  function handleDayToggle(id) {
    setDays((prev) => prev.map((d) => (d.id === id ? { ...d, enabled: !d.enabled } : d)));
  }

  function handleSubjectChange(id, field, value) {
    setSubjects((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: field === 'sessions' ? Number(value) || 0 : value } : s)));
  }

  function handleAddSubject() {
    setSubjects((prev) => [...prev, emptySubjectRow(prev.length ? prev[prev.length - 1].id + 1 : 1)]);
  }

  function handleRemoveSubject(id) {
    setSubjects((prev) => prev.filter((s) => s.id !== id));
  }

  function handleGenerate() {
    setInfoMessage('');
    setRemaining(null);

    if (parseTimeToMinutes(endTime) <= parseTimeToMinutes(startTime)) {
      setGrid(null);
      setInfoMessage('College end time must be after start time.');
      return;
    }

    if (!activeDays.length) {
      setGrid(null);
      setInfoMessage('Select at least one teaching day.');
      return;
    }

    const validSubjects = subjects.filter((s) => s.name.trim() && Number(s.sessions) > 0);
    if (!validSubjects.length) {
      setGrid(null);
      setInfoMessage('Add at least one subject with a positive number of sessions.');
      return;
    }

    const result = generateGrid({
      activeDays,
      slots,
      subjects: validSubjects,
      avoidConsecutive,
      maxPerDay: Number(maxPerDay) || 0,
    });

    if (!result.grid) {
      setGrid(null);
      setInfoMessage(result.message);
      return;
    }

    setGrid(result.grid);
    setRemaining(result.remainingBySubject || {});
    setInfoMessage(result.message || 'Timetable generated successfully.');
  }

  return (
    <div className="app-root">
      <header className="app-header">
        <div>
          <h1>University Timetable Auto Generator</h1>
          <p className="subtitle">Configure your rules and generate a clean, printable timetable.</p>
        </div>
      </header>

      <main className="app-main">
        <section className="panel settings-panel">
          <h2>Configuration</h2>

          <div className="section-block">
            <h3>Teaching Days</h3>
            <div className="day-checkbox-row">
              {days.map((day) => (
                <label key={day.id} className="checkbox-pill">
                  <input
                    type="checkbox"
                    checked={day.enabled}
                    onChange={() => handleDayToggle(day.id)}
                  />
                  <span>{day.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="section-block">
            <h3>Time Slots & Alignment</h3>
            <div className="form-grid">
              <label>
                Start time
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </label>
              <label>
                College end time
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </label>
              <label>
                Minutes per class
                <input
                  type="number"
                  min="20"
                  max="180"
                  value={slotMinutes}
                  onChange={(e) => setSlotMinutes(e.target.value)}
                />
              </label>
              <label>
                Periods before lunch
                <input
                  type="number"
                  min="0"
                  value={periodsBeforeLunch}
                  onChange={(e) => setPeriodsBeforeLunch(e.target.value)}
                />
              </label>
              <label>
                Lunch break (minutes)
                <input
                  type="number"
                  min="20"
                  max="90"
                  value={lunchMinutes}
                  onChange={(e) => setLunchMinutes(e.target.value)}
                />
              </label>
              <label>
                Periods after lunch
                <input
                  type="number"
                  min="0"
                  value={periodsAfterLunch}
                  onChange={(e) => setPeriodsAfterLunch(e.target.value)}
                />
              </label>
            </div>
            <p className="hint">
              Teaching slots per day: <strong>{teachingSlotsPerDay}</strong> | Total teaching slots:{' '}
              <strong>{totalTeachingSlots}</strong> | Requested sessions: <strong>{totalRequestedSessions}</strong>
            </p>
          </div>

          <div className="section-block">
            <h3>Subjects & Weekly Load</h3>
            <div className="subjects-table-wrapper">
              <table className="subjects-table">
                <thead>
                  <tr>
                    <th style={{ width: '40%' }}>Subject / Course</th>
                    <th style={{ width: '30%' }}>Faculty name</th>
                    <th style={{ width: '15%' }}>Sessions / week</th>
                    <th style={{ width: '15%' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((subject) => (
                    <tr key={subject.id}>
                      <td>
                        <input
                          type="text"
                          placeholder="e.g., Constitutional Law I"
                          value={subject.name}
                          onChange={(e) => handleSubjectChange(subject.id, 'name', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          placeholder="e.g., Dr. Sharma"
                          value={subject.faculty || ''}
                          onChange={(e) => handleSubjectChange(subject.id, 'faculty', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          value={subject.sessions}
                          onChange={(e) => handleSubjectChange(subject.id, 'sessions', e.target.value)}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-secondary btn-small"
                          onClick={() => handleRemoveSubject(subject.id)}
                          disabled={subjects.length <= 1}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="btn-link" onClick={handleAddSubject}>
              + Add another subject
            </button>
          </div>

          <div className="section-block">
            <h3>Rules</h3>
            <div className="rules-grid">
              <label className="checkbox-line">
                <input
                  type="checkbox"
                  checked={avoidConsecutive}
                  onChange={(e) => setAvoidConsecutive(e.target.checked)}
                />
                <span>Avoid back-to-back classes for the same subject (where possible)</span>
              </label>
              <label>
                Maximum classes per subject per day (0 = no limit)
                <input
                  type="number"
                  min="0"
                  value={maxPerDay}
                  onChange={(e) => setMaxPerDay(e.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="section-block actions-row">
            <button type="button" className="btn-primary" onClick={handleGenerate}>
              Generate timetable
            </button>
          </div>

          {infoMessage && <p className="info-message">{infoMessage}</p>}
          {remaining && Object.keys(remaining).length > 0 && (
            <div className="remaining-warning">
              <span>Unscheduled classes:</span>
              <ul>
                {Object.entries(remaining).map(([subjectName, count]) => (
                  <li key={subjectName}>
                    <span className="subject-name">{subjectName}</span> 
                    
                    
                    
                    - {count} class{count > 1 ? 'es' : ''} remaining
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="panel timetable-panel">
          <h2>Generated Timetable</h2>
          {!grid && <p className="hint">Fill in the configuration and click "Generate timetable".</p>}
          {grid && (
            <div className="timetable-wrapper">
              <table className="timetable-table">
                <thead>
                  <tr>
                    <th>Day / Time</th>
                    {slots.map((slot) => (
                      <th key={slot.id}>{slot.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grid.map((row, rowIndex) => (
                    <tr key={activeDays[rowIndex].id}>
                      <th className="day-header">{activeDays[rowIndex].label}</th>
                      {row.map((cell, colIndex) => (
                        <td
                          key={slots[colIndex].id}
                          className={slots[colIndex].isLunch ? 'cell-lunch' : 'cell-class'}
                        >
                          {slots[colIndex].isLunch ? (
                            'Lunch Break'
                          ) : cell === 'Free Slot' ? (
                            'Free Slot'
                          ) : (
                            <>
                              <div className="cell-subject">{cell}</div>
                              {facultyBySubject[cell] && (
                                <div className="cell-faculty">{facultyBySubject[cell]}</div>
                              )}
                            </>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="print-hint">Tip: Use your browser print dialog to export as PDF.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
