// Shared FSBT program data (project 4288) used by FsbtProgram, FsbtCost, FsbtRevenue.
// 5 parent phases + 19 child activities, Aug 2023 – Oct 2026 (39 months).

export interface FsbtProgramRow {
  id: number;
  parentId: number | null;
  code: string;
  name: string;
  duration: number | null;
  /** YYYY-MM-01 */
  start: string;
  /** YYYY-MM-01 */
  end: string;
  startColumn: number;
  endColumn: number;
}

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'] as const;

/** Convert "Mon YY" (e.g. "Aug 23") → "YYYY-MM-01" — timezone-safe. */
export function parseMonYY(s: string): string {
  if (!s) return '';
  const months: Record<string, number> = {
    Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, June: 6, Jun: 6, July: 7, Jul: 7,
    Aug: 8, Sept: 9, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
  };
  const parts = s.split(' ');
  const m = months[parts[0]!] ?? 1;
  const y = 2000 + parseInt(parts[1] || '0', 10);
  return `${y}-${String(m).padStart(2, '0')}-01`;
}

/** Format YYYY-MM-DD → "Mon YY" (e.g. "Sept 23") — timezone-safe. */
export function formatMonYY(dateStr: string): string {
  if (!dateStr) return '';
  const [yStr, mStr] = dateStr.split('-');
  if (!yStr || !mStr) return dateStr;
  const m = parseInt(mStr, 10) - 1;
  return `${MONTH_NAMES_SHORT[m] ?? mStr} ${yStr.slice(2)}`;
}

/** Column index (0-based) for a YYYY-MM-01 date relative to Aug 2023 base. */
export function toColIndex(dateIso: string): number {
  if (!dateIso) return -1;
  const [yStr, mStr] = dateIso.split('-');
  if (!yStr || !mStr) return -1;
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  return (y - 2023) * 12 + (m - 8);
}

/** Inverse of toColIndex — column index → YYYY-MM-01. */
export function columnToDate(colIndex: number): string {
  const base = new Date(2023, 7, 1);
  const d = new Date(base.getFullYear(), base.getMonth() + colIndex, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function row(id: number, parentId: number | null, code: string, name: string, dur: number | null, start: string, end: string): FsbtProgramRow {
  const startIso = parseMonYY(start);
  const endIso = parseMonYY(end);
  return {
    id, parentId, code, name,
    duration: dur,
    start: startIso,
    end: endIso,
    startColumn: toColIndex(startIso),
    endColumn: toColIndex(endIso),
  };
}

export const FSBT_PROGRAM_ROWS: FsbtProgramRow[] = [
  row(1, null, '1', 'Acquisition', 6, 'Aug 23', 'Jan 24'),
  row(2, 1, '1.1', 'Due Diligence', 4, 'Aug 23', 'Nov 23'),
  row(3, 1, '1.2', 'Deposit', 1, 'Aug 23', 'Aug 23'),
  row(4, 1, '1.3', 'Settlement', 1, 'Jan 24', 'Jan 24'),

  row(5, null, '2', 'Planning And Design', 20, 'Aug 23', 'Mar 25'),
  row(6, 5, '2.1', 'Design Prep To Lodgement', 3, 'Aug 23', 'Oct 23'),
  row(7, 5, '2.2', 'Planning Assessment', 3, 'Nov 23', 'Jan 24'),
  row(8, 5, '2.3', 'Civil And Administrative Tribunal', 6, 'Nov 23', 'Apr 24'),
  row(9, 5, '2.4', 'Prepare Design Amendment', 3, 'May 24', 'July 24'),
  row(10, 5, '2.5', 'Amendment Approval', 2, 'Aug 24', 'Sept 24'),
  row(11, 5, '2.6', '50% Detail Design', 2, 'Oct 24', 'Nov 24'),
  row(12, 5, '2.7', '70% Detail Design', 2, 'Dec 24', 'Jan 25'),
  row(13, 5, '2.8', '100% Detail Design', 2, 'Feb 25', 'Mar 25'),

  row(14, null, '3', 'Construction And Building Works', 24, 'Oct 24', 'Sept 26'),
  row(15, 14, '3.1', 'Demolition', 3, 'Oct 24', 'Dec 24'),
  row(16, 14, '3.2', 'Early Work/Excavation', 6, 'Jan 25', 'June 25'),
  row(17, 14, '3.3', 'Main Works', 18, 'Apr 25', 'Sept 26'),

  row(18, null, '4', 'Marketing And Sales', 20, 'Mar 25', 'Oct 26'),
  row(19, 18, '4.1', 'Marketing Prep', 6, 'Mar 25', 'Aug 25'),
  row(20, 18, '4.2', 'Marketing Activity', 13, 'Sep 25', 'Sept 26'),
  row(21, 18, '4.3', 'Sales/Leasing Period', 13, 'Sep 25', 'Sept 26'),
  row(22, 18, '4.4', 'Settlement Management', 1, 'Oct 26', 'Oct 26'),

  row(23, null, '5', 'Operation/Asset Management', 1, 'Oct 26', 'Oct 26'),
  row(24, 23, '5.1', 'Lease Up Period', 1, 'Oct 26', 'Oct 26'),
  row(25, 23, '5.2', 'Holding Period', 1, 'Oct 26', 'Oct 26'),
  row(26, 23, '5.3', 'Termination', 1, 'Oct 26', 'Oct 26'),
];
