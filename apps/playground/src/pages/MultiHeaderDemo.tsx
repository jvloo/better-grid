import { useMemo } from 'react';
import { BetterGrid } from '@better-grid/react';
import type { ColumnDef, HeaderRow } from '@better-grid/core';
import { formatting, sorting, mergeCells } from '@better-grid/plugins';
import '@better-grid/core/styles.css';

interface CompanyRow {
  id: number;
  name: string;
  sector: string;
  region: string;
  revQ1: number;
  revQ2: number;
  revQ3: number;
  expQ1: number;
  expQ2: number;
  expQ3: number;
  net: number;
  margin: number;
}

const data: CompanyRow[] = [
  { id: 1, name: 'Acme Corp', sector: 'Technology', region: 'North America', revQ1: 4200000, revQ2: 4800000, revQ3: 5100000, expQ1: 2800000, expQ2: 3100000, expQ3: 3200000, net: 5000000, margin: 0.35 },
  { id: 2, name: 'Globex Inc', sector: 'Finance', region: 'Europe', revQ1: 3100000, revQ2: 3400000, revQ3: 3600000, expQ1: 2200000, expQ2: 2400000, expQ3: 2500000, net: 3000000, margin: 0.30 },
  { id: 3, name: 'Initech', sector: 'Technology', region: 'North America', revQ1: 2800000, revQ2: 3200000, revQ3: 3500000, expQ1: 1900000, expQ2: 2100000, expQ3: 2300000, net: 3200000, margin: 0.34 },
  { id: 4, name: 'Umbrella Co', sector: 'Healthcare', region: 'Asia Pacific', revQ1: 5500000, revQ2: 5900000, revQ3: 6200000, expQ1: 3800000, expQ2: 4000000, expQ3: 4200000, net: 5600000, margin: 0.32 },
  { id: 5, name: 'Stark Industries', sector: 'Defense', region: 'North America', revQ1: 8200000, revQ2: 8800000, revQ3: 9500000, expQ1: 5500000, expQ2: 5900000, expQ3: 6100000, net: 9000000, margin: 0.34 },
  { id: 6, name: 'Wayne Enterprises', sector: 'Conglomerate', region: 'North America', revQ1: 7100000, revQ2: 7500000, revQ3: 7800000, expQ1: 4800000, expQ2: 5100000, expQ3: 5300000, net: 6200000, margin: 0.28 },
  { id: 7, name: 'Oscorp', sector: 'Biotech', region: 'Europe', revQ1: 3800000, revQ2: 4100000, revQ3: 4400000, expQ1: 2600000, expQ2: 2800000, expQ3: 3000000, net: 3900000, margin: 0.32 },
  { id: 8, name: 'Cyberdyne', sector: 'Technology', region: 'Asia Pacific', revQ1: 6100000, revQ2: 6600000, revQ3: 7200000, expQ1: 4200000, expQ2: 4500000, expQ3: 4800000, net: 6400000, margin: 0.32 },
  { id: 9, name: 'Soylent Corp', sector: 'Food & Bev', region: 'Latin America', revQ1: 2100000, revQ2: 2400000, revQ3: 2700000, expQ1: 1500000, expQ2: 1700000, expQ3: 1900000, net: 2100000, margin: 0.29 },
  { id: 10, name: 'Weyland-Yutani', sector: 'Aerospace', region: 'Europe', revQ1: 9200000, revQ2: 9800000, revQ3: 10500000, expQ1: 6500000, expQ2: 6900000, expQ3: 7200000, net: 8900000, margin: 0.30 },
];

export function MultiHeaderDemo() {
  const headerRows = useMemo<HeaderRow[]>(
    () => [
      {
        id: 'groups',
        height: 32,
        cells: [
          { id: 'g-info', content: 'Company Info', colSpan: 3 },
          { id: 'g-rev', content: 'Revenue', colSpan: 3 },
          { id: 'g-exp', content: 'Expenses', colSpan: 3 },
          { id: 'g-summary', content: 'Summary', colSpan: 2 },
        ],
      },
      {
        id: 'columns',
        height: 32,
        cells: [
          { id: 'h-name', content: 'Name', columnId: 'name' },
          { id: 'h-sector', content: 'Sector', columnId: 'sector' },
          { id: 'h-region', content: 'Region', columnId: 'region' },
          { id: 'h-revq1', content: 'Q1', columnId: 'revQ1' },
          { id: 'h-revq2', content: 'Q2', columnId: 'revQ2' },
          { id: 'h-revq3', content: 'Q3', columnId: 'revQ3' },
          { id: 'h-expq1', content: 'Q1', columnId: 'expQ1' },
          { id: 'h-expq2', content: 'Q2', columnId: 'expQ2' },
          { id: 'h-expq3', content: 'Q3', columnId: 'expQ3' },
          { id: 'h-net', content: 'Net', columnId: 'net' },
          { id: 'h-margin', content: 'Margin', columnId: 'margin' },
        ],
      },
    ],
    [],
  );

  const columns = useMemo<ColumnDef<CompanyRow>[]>(
    () => [
      { id: 'name', header: 'Name', width: 160, sortable: true },
      { id: 'sector', header: 'Sector', width: 120, sortable: true },
      { id: 'region', header: 'Region', width: 130, sortable: true },
      { id: 'revQ1', header: 'Q1', width: 110, cellType: 'currency', sortable: true },
      { id: 'revQ2', header: 'Q2', width: 110, cellType: 'currency', sortable: true },
      { id: 'revQ3', header: 'Q3', width: 110, cellType: 'currency', sortable: true },
      { id: 'expQ1', header: 'Q1', width: 110, cellType: 'currency', sortable: true },
      { id: 'expQ2', header: 'Q2', width: 110, cellType: 'currency', sortable: true },
      { id: 'expQ3', header: 'Q3', width: 110, cellType: 'currency', sortable: true },
      {
        id: 'net',
        header: 'Net',
        width: 120,
        cellType: 'currency',
        sortable: true,
        cellRenderer: (el: HTMLElement, ctx: { value: unknown }) => {
          const val = ctx.value as number;
          el.textContent = `$${(val / 1_000_000).toFixed(1)}M`;
          el.style.fontWeight = '600';
          el.style.color = val >= 5_000_000 ? '#2e7d32' : '#333';
        },
      },
      {
        id: 'margin',
        header: 'Margin',
        width: 90,
        cellType: 'percent',
        sortable: true,
        cellRenderer: (el: HTMLElement, ctx: { value: unknown }) => {
          const val = ctx.value as number;
          el.textContent = `${(val * 100).toFixed(0)}%`;
          el.style.fontWeight = '500';
          el.style.color = val >= 0.33 ? '#2e7d32' : val >= 0.30 ? '#f57f17' : '#c62828';
        },
      },
    ],
    [],
  );

  const plugins = useMemo(
    () => [
      formatting({ locale: 'en-US', currencyCode: 'USD' }),
      sorting(),
    ],
    [],
  );

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Multi-Level Column Headers</h1>
      <p style={{ marginBottom: 8, color: '#666', lineHeight: 1.5 }}>
        Multi-level column headers with colSpan and rowSpan. Group related columns under shared headers.
      </p>
      <div style={{ marginBottom: 16, fontSize: 13, color: '#888', lineHeight: 1.6 }}>
        <strong>Header structure:</strong>
        <br />
        Row 1: Company Info (span 3) | Revenue (span 3) | Expenses (span 3) | Summary (span 2)
        <br />
        Row 2: Name | Sector | Region | Q1 | Q2 | Q3 | Q1 | Q2 | Q3 | Net | Margin
        <br />
        <strong>Formatting:</strong> Revenue/Expenses in USD &bull; Net as abbreviated ($XM) &bull; Margin as percentage
      </div>

      <BetterGrid<CompanyRow>
        columns={columns}
        data={data}
        headerRows={headerRows}
        frozenLeftColumns={1}
        selection={{ mode: 'range' }}
        plugins={plugins}
        height={400}
      />

      <MergeCellsDemo />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Merge Cells Demo — body cell spanning (Pro feature)
// ---------------------------------------------------------------------------

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
];

const scheduleColumns: ColumnDef<ScheduleRow>[] = [
  { id: 'day', header: 'Day', width: 100 },
  { id: 'time', header: 'Time', width: 70, align: 'center' },
  { id: 'room', header: 'Room', width: 70, align: 'center' },
  { id: 'subject', header: 'Subject', width: 150 },
  { id: 'instructor', header: 'Instructor', width: 130 },
  { id: 'type', header: 'Type', width: 90 },
];

function MergeCellsDemo() {
  // Auto-detect merge ranges: merge consecutive rows with same day, and same subject blocks
  const mergeConfig = useMemo(() => {
    const cells: Array<{ row: number; col: number; rowSpan?: number; colSpan?: number }> = [];

    // Merge "Day" column (col 0) for consecutive same-day rows
    let i = 0;
    while (i < scheduleData.length) {
      let j = i + 1;
      while (j < scheduleData.length && scheduleData[j]!.day === scheduleData[i]!.day) j++;
      if (j - i > 1) cells.push({ row: i, col: 0, rowSpan: j - i });
      i = j;
    }

    // Merge subject blocks (cols 3-5: subject, instructor, type) for consecutive identical rows
    i = 0;
    while (i < scheduleData.length) {
      let j = i + 1;
      while (j < scheduleData.length &&
        scheduleData[j]!.subject === scheduleData[i]!.subject &&
        scheduleData[j]!.instructor === scheduleData[i]!.instructor) j++;
      if (j - i > 1) {
        cells.push({ row: i, col: 3, rowSpan: j - i }); // subject
        cells.push({ row: i, col: 4, rowSpan: j - i }); // instructor
        cells.push({ row: i, col: 5, rowSpan: j - i }); // type
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
    <>
      <h2 style={{ fontSize: 18, marginBottom: 8, marginTop: 32 }}>Merge Cells <span style={{ fontSize: 11, color: '#999', fontWeight: 400 }}>Pro</span></h2>
      <p style={{ marginBottom: 8, color: '#888', fontSize: 13, lineHeight: 1.5 }}>
        Body cell spanning — consecutive identical values merged into a single cell.
        Day column spans all timeslots, subject blocks span their duration.
      </p>

      <BetterGrid<ScheduleRow>
        columns={scheduleColumns}
        data={scheduleData}
        plugins={plugins}
        selection={{ mode: 'range' }}
        height={400}
      />
    </>
  );
}
