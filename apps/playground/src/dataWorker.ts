// Data generation worker — generates realistic mock data off the main thread
// Inspired by RevoGrid's columnGenerator.worker approach

const FIRST_NAMES = ['Emma','Liam','Olivia','Noah','Ava','James','Sophia','William','Isabella','Oliver','Mia','Benjamin','Charlotte','Elijah','Amelia','Lucas','Harper','Mason','Evelyn','Logan','Abigail','Alexander','Emily','Ethan','Ella','Jacob','Grace','Michael','Chloe','Daniel'];
const LAST_NAMES = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Anderson','Taylor','Thomas','Moore','Jackson','Martin','Lee','Perez','Clark','Lewis','Walker','Hall','Allen','Young','King','Wright','Lopez','Hill','Scott','Green'];
const COMPANIES = ['ACME Corp','Globex','Initech','Umbrella','Stark Industries','Wayne Tech','Cyberdyne','Oscorp','LexCorp','Aperture','Weyland','Soylent','Massive Dynamic','Abstergo','GeneCo','Tyrell','Buy n Large','InGen','Wonka','Prestige'];
const DEPARTMENTS = ['Engineering','Sales','Marketing','Finance','HR','Operations','Product','Design','Legal','Support'];
const STATUSES = ['Active','Pending','On Hold','Done','In Review','Cancelled'];
const COLORS = ['blue','green','red','orange','purple','teal','pink','brown','gray','navy'];
const PRODUCTS = ['Widget Pro','Gadget X','Sensor Pack','IoT Hub','Cable Kit','Mount Arm','Display 4K','Tool Kit','Mesh Router','Dev Board'];
const CATEGORIES = ['Electronics','Hardware','IoT','Software','Networking','Accessories'];

function randomFrom<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length]!;
}

function randomDate(seed: number): string {
  const y = 2020 + (Math.abs(seed) % 7);
  const m = (Math.abs(seed * 3) % 12) + 1;
  const d = (Math.abs(seed * 7) % 28) + 1;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function randomNumber(seed: number, min: number, max: number): number {
  return Math.round((Math.abs(seed * 13 + 37) % (max - min)) + min);
}

function randomDecimal(seed: number, min: number, max: number, decimals = 2): number {
  const raw = (Math.abs(seed * 7 + 13) % ((max - min) * 100)) / 100 + min;
  return parseFloat(raw.toFixed(decimals));
}

export interface WorkerMessage {
  rowsNumber: number;
  colsNumber: number;
}

export interface GeneratedData {
  rows: Record<string, unknown>[];
  genTime: number;
}

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { rowsNumber, colsNumber } = event.data;
  const start = performance.now();

  const rows: Record<string, unknown>[] = new Array(rowsNumber);

  for (let r = 0; r < rowsNumber; r++) {
    const seed = r * 31 + 17;
    const row: Record<string, unknown> = {};

    for (let c = 0; c < colsNumber; c++) {
      const cellSeed = seed + c * 13;
      const colType = c % 8;

      switch (colType) {
        case 0: // Name
          row[`col${c}`] = `${randomFrom(FIRST_NAMES, cellSeed)} ${randomFrom(LAST_NAMES, cellSeed + 7)}`;
          break;
        case 1: // Company
          row[`col${c}`] = randomFrom(COMPANIES, cellSeed);
          break;
        case 2: // Number (currency-like)
          row[`col${c}`] = randomNumber(cellSeed, 1000, 500000);
          break;
        case 3: // Percentage
          row[`col${c}`] = randomDecimal(cellSeed, 0, 1);
          break;
        case 4: // Date
          row[`col${c}`] = randomDate(cellSeed);
          break;
        case 5: // Status
          row[`col${c}`] = randomFrom(STATUSES, cellSeed);
          break;
        case 6: // Boolean
          row[`col${c}`] = cellSeed % 3 !== 0;
          break;
        case 7: // Score
          row[`col${c}`] = randomDecimal(cellSeed, 1, 5, 1);
          break;
      }
    }

    rows[r] = row;
  }

  const genTime = Math.round(performance.now() - start);
  self.postMessage({ rows, genTime } satisfies GeneratedData);
};
