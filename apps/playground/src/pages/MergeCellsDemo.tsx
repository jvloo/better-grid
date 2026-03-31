import { useMemo } from 'react';
import { BetterGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { formatting, mergeCells } from '@better-grid/plugins';
import '@better-grid/core/styles.css';

interface ScheduleRow {
  day: string;
  time: string;
  room: string;
  subject: string;
  instructor: string;
  type: string;
}

const scheduleData: ScheduleRow[] = [
  { day: 'Monday', time: '09:00', room: 'A101', subject: 'Mathematics', instructor: 'Dr. Chen', type: 'Lecture' },
  { day: 'Monday', time: '10:00', room: 'A101', subject: 'Mathematics', instructor: 'Dr. Chen', type: 'Lecture' },
  { day: 'Monday', time: '11:00', room: 'B202', subject: 'Physics Lab', instructor: 'Prof. Smith', type: 'Lab' },
  { day: 'Monday', time: '12:00', room: 'B202', subject: 'Physics Lab', instructor: 'Prof. Smith', type: 'Lab' },
  { day: 'Monday', time: '13:00', room: 'B202', subject: 'Physics Lab', instructor: 'Prof. Smith', type: 'Lab' },
  { day: 'Monday', time: '14:00', room: 'C303', subject: 'English', instructor: 'Ms. Taylor', type: 'Seminar' },
  { day: 'Tuesday', time: '09:00', room: 'A101', subject: 'Chemistry', instructor: 'Dr. Park', type: 'Lecture' },
  { day: 'Tuesday', time: '10:00', room: 'A101', subject: 'Chemistry', instructor: 'Dr. Park', type: 'Lecture' },
  { day: 'Tuesday', time: '11:00', room: 'D404', subject: 'CS Workshop', instructor: 'Dr. Kumar', type: 'Workshop' },
  { day: 'Tuesday', time: '12:00', room: 'D404', subject: 'CS Workshop', instructor: 'Dr. Kumar', type: 'Workshop' },
  { day: 'Tuesday', time: '13:00', room: 'D404', subject: 'CS Workshop', instructor: 'Dr. Kumar', type: 'Workshop' },
  { day: 'Tuesday', time: '14:00', room: 'D404', subject: 'CS Workshop', instructor: 'Dr. Kumar', type: 'Workshop' },
  { day: 'Wednesday', time: '09:00', room: 'A101', subject: 'Mathematics', instructor: 'Dr. Chen', type: 'Lecture' },
  { day: 'Wednesday', time: '10:00', room: 'B202', subject: 'Biology', instructor: 'Prof. Jones', type: 'Lecture' },
  { day: 'Wednesday', time: '11:00', room: 'B202', subject: 'Biology', instructor: 'Prof. Jones', type: 'Lecture' },
  { day: 'Wednesday', time: '12:00', room: 'C303', subject: 'History', instructor: 'Dr. Wilson', type: 'Seminar' },
  { day: 'Wednesday', time: '13:00', room: 'C303', subject: 'History', instructor: 'Dr. Wilson', type: 'Seminar' },
  { day: 'Wednesday', time: '14:00', room: 'C303', subject: 'History', instructor: 'Dr. Wilson', type: 'Seminar' },
  { day: 'Thursday', time: '09:00', room: 'A101', subject: 'Mathematics', instructor: 'Dr. Chen', type: 'Lecture' },
  { day: 'Thursday', time: '10:00', room: 'A101', subject: 'Mathematics', instructor: 'Dr. Chen', type: 'Lecture' },
  { day: 'Thursday', time: '11:00', room: 'B202', subject: 'Physics Lab', instructor: 'Prof. Smith', type: 'Lab' },
  { day: 'Thursday', time: '12:00', room: 'B202', subject: 'Physics Lab', instructor: 'Prof. Smith', type: 'Lab' },
  { day: 'Thursday', time: '13:00', room: 'C303', subject: 'English', instructor: 'Ms. Taylor', type: 'Seminar' },
  { day: 'Thursday', time: '14:00', room: 'C303', subject: 'English', instructor: 'Ms. Taylor', type: 'Seminar' },
];

const columns: ColumnDef<ScheduleRow>[] = [
  { id: 'day', header: 'Day', width: 110 },
  { id: 'time', header: 'Time', width: 70, align: 'center' },
  { id: 'room', header: 'Room', width: 70, align: 'center' },
  { id: 'subject', header: 'Subject', width: 160 },
  { id: 'instructor', header: 'Instructor', width: 140 },
  { id: 'type', header: 'Type', width: 100 },
];

export function MergeCellsDemo() {
  const mergeConfig = useMemo(() => {
    const cells: Array<{ row: number; col: number; rowSpan?: number; colSpan?: number }> = [];

    // Merge "Day" column for consecutive same-day rows
    let i = 0;
    while (i < scheduleData.length) {
      let j = i + 1;
      while (j < scheduleData.length && scheduleData[j]!.day === scheduleData[i]!.day) j++;
      if (j - i > 1) cells.push({ row: i, col: 0, rowSpan: j - i });
      i = j;
    }

    // Merge subject blocks (subject + instructor + type) for consecutive identical sessions
    i = 0;
    while (i < scheduleData.length) {
      let j = i + 1;
      while (j < scheduleData.length &&
        scheduleData[j]!.subject === scheduleData[i]!.subject &&
        scheduleData[j]!.instructor === scheduleData[i]!.instructor &&
        scheduleData[j]!.day === scheduleData[i]!.day) j++;
      if (j - i > 1) {
        cells.push({ row: i, col: 3, rowSpan: j - i });
        cells.push({ row: i, col: 4, rowSpan: j - i });
        cells.push({ row: i, col: 5, rowSpan: j - i });
      }
      i = j;
    }

    return cells;
  }, []);

  const plugins = useMemo(
    () => [
      formatting(),
      mergeCells({ cells: mergeConfig }),
    ],
    [mergeConfig],
  );

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>
        Merge Cells <span style={{ fontSize: 12, color: '#999', fontWeight: 400 }}>Pro</span>
      </h1>
      <p style={{ marginBottom: 8, color: '#666', lineHeight: 1.5 }}>
        Body cell spanning — consecutive identical values merged into a single cell.
        Day column spans all timeslots, subject/instructor/type blocks span their duration.
      </p>
      <div style={{ marginBottom: 12, fontSize: 12, color: '#999', lineHeight: 1.5 }}>
        <strong>Plugin:</strong> mergeCells (Pro) &bull;
        <strong> Config:</strong> Static array of {'{'} row, col, rowSpan, colSpan {'}'} &bull;
        <strong> API:</strong> addMerge, removeMerge, clearMerges, getMergeAt
      </div>

      <BetterGrid<ScheduleRow>
        columns={columns}
        data={scheduleData}
        plugins={plugins}
        selection={{ mode: 'range' }}
        height={520}
      />
    </div>
  );
}
