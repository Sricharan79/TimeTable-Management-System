const generateTimetable = (subjects, teachers) => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const periods = [1, 2, 3, 4, 5];

  let timetable = [];
  let teacherSchedule = {};
  let teacherSubjectMap = {};

  for (let day of days) {
    for (let period of periods) {

      let assigned = false;

      const shuffledSubjects = [...subjects].sort(() => 0.5 - Math.random());

      for (let subject of shuffledSubjects) {

        let validTeachers = teachers.filter(t =>
          t.subjects.some(s => s.toString() === subject._id.toString())
        );

        for (let teacher of validTeachers) {

          const timeKey = `${teacher._id}-${day}-${period}`;
          const subjectKey = `${teacher._id}-${subject._id}`;

          if (teacherSchedule[timeKey]) continue;
          if (teacherSubjectMap[subjectKey]) continue;

          timetable.push({
            day,
            period,
            subjectId: subject._id,
            teacherId: teacher._id
          });

          teacherSchedule[timeKey] = true;
          teacherSubjectMap[subjectKey] = true;

          assigned = true;
          break;
        }

        if (assigned) break;
      }

      if (!assigned) {
        timetable.push({
          day,
          period,
          subjectId: null,
          teacherId: null
        });
      }
    }
  }

  return timetable;
};

module.exports = generateTimetable;