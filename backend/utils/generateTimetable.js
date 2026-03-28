const defaultTimeSlots = [
  { period: 1, start: '09:30', end: '10:20' },
  { period: 2, start: '10:20', end: '11:10' },
  { period: 3, start: '11:10', end: '12:00' },
  { period: 4, start: '12:00', end: '12:50' },
  { period: 5, start: '13:20', end: '14:10' },
  { period: 6, start: '14:10', end: '15:00' },
  { period: 7, start: '15:00', end: '15:50' },
  { period: 8, start: '15:50', end: '16:40' }
];

const shuffle = (items) => [...items].sort(() => 0.5 - Math.random());

const generateTimetable = (subjects, teachers, options = {}) => {
  const days = options.days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const timeSlots = options.timeSlots || defaultTimeSlots;
  const maxClassesPerSubjectPerDay = options.maxClassesPerSubjectPerDay || 2;
  const classesPerSubjectPerWeek = options.classesPerSubjectPerWeek || 6;
  const maxSubjectsPerTeacher = options.maxSubjectsPerTeacher || 4;
  const maxSubjectsPerTeacherPerSection = options.maxSubjectsPerTeacherPerSection || 1;
  const existingTeacherSchedule = options.existingTeacherSchedule || new Set();

  const timetable = [];
  const teacherSchedule = new Set(existingTeacherSchedule);
  const subjectCountsByDay = new Map();
  const subjectCountsByWeek = new Map();
  const teacherSubjectMap = new Map();
  const subjectTeacherAssignment = new Map();
  const teacherAssignedSubjectId = new Map();

  for (const day of days) {
    for (const slot of timeSlots) {
      let assigned = false;

      const sortedSubjects = shuffle(subjects).sort((a, b) => {
        const aId = a._id.toString();
        const bId = b._id.toString();
        const aDayKey = `${day}-${aId}`;
        const bDayKey = `${day}-${bId}`;
        const aDayCount = subjectCountsByDay.get(aDayKey) || 0;
        const bDayCount = subjectCountsByDay.get(bDayKey) || 0;
        const aWeekCount = subjectCountsByWeek.get(aId) || 0;
        const bWeekCount = subjectCountsByWeek.get(bId) || 0;
        const aRatio = aWeekCount / classesPerSubjectPerWeek;
        const bRatio = bWeekCount / classesPerSubjectPerWeek;

        if (aRatio !== bRatio) return aRatio - bRatio;
        return aDayCount - bDayCount;
      });

      for (const subject of sortedSubjects) {
        const subjectId = subject._id.toString();
        const dayKey = `${day}-${subjectId}`;
        const currentDayCount = subjectCountsByDay.get(dayKey) || 0;
        const currentWeekCount = subjectCountsByWeek.get(subjectId) || 0;
        if (currentDayCount >= maxClassesPerSubjectPerDay) continue;
        if (currentWeekCount >= classesPerSubjectPerWeek) continue;

        const assignedTeacherId = subjectTeacherAssignment.get(subjectId);
        const validTeachers = shuffle(
          teachers.filter((teacher) =>
            teacher.subjects.some((sub) => sub.toString() === subjectId)
          )
        ).filter((teacher) => {
          const teacherId = teacher._id.toString();
          if (assignedTeacherId && teacherId !== assignedTeacherId) return false;
          return true;
        });

        for (const teacher of validTeachers) {
          const teacherId = teacher._id.toString();
          const assignedSubjectId = teacherAssignedSubjectId.get(teacherId);
          if (assignedSubjectId && assignedSubjectId !== subjectId && maxSubjectsPerTeacherPerSection === 1) {
            continue;
          }
          const timeKey = `${teacherId}-${day}-${slot.period}`;
          if (teacherSchedule.has(timeKey)) continue;

          const taughtSubjects = teacherSubjectMap.get(teacherId) || new Set();
          if (!taughtSubjects.has(subjectId) && taughtSubjects.size >= maxSubjectsPerTeacherPerSection) {
            continue;
          }
          if (!taughtSubjects.has(subjectId) && taughtSubjects.size >= maxSubjectsPerTeacher) {
            continue;
          }

          timetable.push({
            day,
            period: slot.period,
            time: `${slot.start} - ${slot.end}`,
            subjectId: subject._id,
            teacherId: teacher._id
          });

          teacherSchedule.add(timeKey);
          subjectCountsByDay.set(dayKey, currentDayCount + 1);
          subjectCountsByWeek.set(subjectId, currentWeekCount + 1);
          taughtSubjects.add(subjectId);
          teacherSubjectMap.set(teacherId, taughtSubjects);
          subjectTeacherAssignment.set(subjectId, teacherId);
          if (!teacherAssignedSubjectId.has(teacherId)) {
            teacherAssignedSubjectId.set(teacherId, subjectId);
          }

          assigned = true;
          break;
        }

        if (assigned) break;
      }

      if (!assigned) {
        timetable.push({
          day,
          period: slot.period,
          time: `${slot.start} - ${slot.end}`,
          subjectId: null,
          teacherId: null
        });
      }
    }
  }

  const remainingBySubject = {};
  for (const subject of subjects) {
    const subjectId = subject._id.toString();
    const currentWeekCount = subjectCountsByWeek.get(subjectId) || 0;
    remainingBySubject[subjectId] = Math.max(0, classesPerSubjectPerWeek - currentWeekCount);
  }

  return { entries: timetable, timeSlots, remainingBySubject };
};

module.exports = generateTimetable;