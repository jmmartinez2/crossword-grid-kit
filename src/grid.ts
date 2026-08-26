import { CrosswordSyntaxError } from './errors';

/**
 * One across or down word: the squares it covers, in order from its
 * starting (numbered) square, and the text those squares currently hold.
 * Open squares that have no pre-filled letter show up as `.` in `text`.
 */
export interface GridEntry {
  readonly number: number;
  readonly direction: 'across' | 'down';
  readonly row: number;
  readonly col: number;
  readonly length: number;
  readonly cells: ReadonlyArray<{ readonly row: number; readonly col: number }>;
  readonly text: string;
}

/**
 * A parsed crossword grid: a rectangular block of open squares (`.`),
 * blocked squares (`#`), and optionally pre-filled letters (`A`-`Z`).
 */
export class Grid {
  readonly width: number;
  readonly height: number;
  private readonly cells: string[][];
  private readonly numbers: (number | null)[][];
  private readonly entryList: GridEntry[];

  constructor(cells: string[][]) {
    this.height = cells.length;
    this.width = cells.length > 0 ? cells[0].length : 0;
    this.cells = cells;
    this.numbers = numberEntries(cells);
    this.entryList = buildEntries(cells, this.numbers);
  }

  isBlock(row: number, col: number): boolean {
    return this.cellAt(row, col) === '#';
  }

  /** The pre-filled letter at a square, or undefined if it is open or blocked. */
  letterAt(row: number, col: number): string | undefined {
    const cell = this.cellAt(row, col);
    return cell === '.' || cell === '#' ? undefined : cell;
  }

  /**
   * The clue number at a square, if that square is the start of an across
   * or down entry. Squares in the middle of a word have no number.
   */
  numberAt(row: number, col: number): number | undefined {
    const rowNumbers = this.numbers[row];
    const value = rowNumbers ? rowNumbers[col] : undefined;
    return value ?? undefined;
  }

  toText(): string {
    return this.cells.map((row) => row.join('')).join('\n');
  }

  /** Every across and down entry, in numbering order (across before down at a shared number). */
  entries(): readonly GridEntry[] {
    return this.entryList;
  }

  /** Just the across entries, in numbering order. */
  acrossEntries(): readonly GridEntry[] {
    return this.entryList.filter((entry) => entry.direction === 'across');
  }

  /** Just the down entries, in numbering order. */
  downEntries(): readonly GridEntry[] {
    return this.entryList.filter((entry) => entry.direction === 'down');
  }

  /**
   * Whether the grid's block pattern has standard 180-degree rotational
   * symmetry: the square at (row, col) is blocked if and only if the square
   * at (height-1-row, width-1-col) is blocked. This is the convention
   * American-style crosswords are built to; it says nothing about letters,
   * only about where the black squares sit.
   */
  isSymmetric(): boolean {
    return this.symmetryViolations().length === 0;
  }

  /**
   * The squares that break 180-degree rotational symmetry, if any. Each
   * entry is the square earlier in reading order of a pair whose
   * block/open status doesn't match its rotational partner, so a grid with
   * n broken pairs reports n violations rather than 2n.
   */
  symmetryViolations(): ReadonlyArray<{ row: number; col: number }> {
    const violations: { row: number; col: number }[] = [];

    for (let row = 0; row < this.height; row++) {
      for (let col = 0; col < this.width; col++) {
        const pairRow = this.height - 1 - row;
        const pairCol = this.width - 1 - col;
        if (row > pairRow || (row === pairRow && col > pairCol)) continue;

        if (this.isBlock(row, col) !== this.isBlock(pairRow, pairCol)) {
          violations.push({ row, col });
        }
      }
    }

    return violations;
  }

  private cellAt(row: number, col: number): string {
    const cell = this.cells[row]?.[col];
    if (cell === undefined) {
      throw new RangeError(`cell (${row}, ${col}) is outside the ${this.height}x${this.width} grid`);
    }
    return cell;
  }
}

/**
 * Standard crossword numbering: scan left to right, top to bottom, and
 * assign the next number to any open square that starts an across entry
 * (an open run of two or more squares reading right) or a down entry
 * (an open run of two or more squares reading down).
 */
function numberEntries(cells: string[][]): (number | null)[][] {
  const height = cells.length;
  const width = height > 0 ? cells[0].length : 0;
  const numbers: (number | null)[][] = cells.map((row) => row.map(() => null));
  let next = 1;

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      if (cells[row][col] === '#') continue;

      const leftIsEdgeOrBlock = col === 0 || cells[row][col - 1] === '#';
      const rightIsOpen = col + 1 < width && cells[row][col + 1] !== '#';
      const startsAcross = leftIsEdgeOrBlock && rightIsOpen;

      const topIsEdgeOrBlock = row === 0 || cells[row - 1][col] === '#';
      const bottomIsOpen = row + 1 < height && cells[row + 1][col] !== '#';
      const startsDown = topIsEdgeOrBlock && bottomIsOpen;

      if (startsAcross || startsDown) {
        numbers[row][col] = next;
        next += 1;
      }
    }
  }

  return numbers;
}

/**
 * Walk the grid in the same order as numberEntries and, at each numbered
 * square, pull out the across and/or down word that starts there.
 */
function buildEntries(cells: string[][], numbers: (number | null)[][]): GridEntry[] {
  const height = cells.length;
  const width = height > 0 ? cells[0].length : 0;
  const entries: GridEntry[] = [];

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      if (cells[row][col] === '#') continue;

      const number = numbers[row][col];
      if (number === null) continue;

      const leftIsEdgeOrBlock = col === 0 || cells[row][col - 1] === '#';
      const rightIsOpen = col + 1 < width && cells[row][col + 1] !== '#';
      if (leftIsEdgeOrBlock && rightIsOpen) {
        entries.push(readEntry(cells, number, 'across', row, col, width, height));
      }

      const topIsEdgeOrBlock = row === 0 || cells[row - 1][col] === '#';
      const bottomIsOpen = row + 1 < height && cells[row + 1][col] !== '#';
      if (topIsEdgeOrBlock && bottomIsOpen) {
        entries.push(readEntry(cells, number, 'down', row, col, width, height));
      }
    }
  }

  return entries;
}

function readEntry(
  cells: string[][],
  number: number,
  direction: 'across' | 'down',
  row: number,
  col: number,
  width: number,
  height: number
): GridEntry {
  const positions: { row: number; col: number }[] = [];
  let r = row;
  let c = col;
  while (r < height && c < width && cells[r][c] !== '#') {
    positions.push({ row: r, col: c });
    if (direction === 'across') {
      c += 1;
    } else {
      r += 1;
    }
  }

  const text = positions.map(({ row: pr, col: pc }) => cells[pr][pc]).join('');

  return { number, direction, row, col, length: positions.length, cells: positions, text };
}

const OPEN = '.';
const BLOCK = '#';

function isValidCellChar(ch: string): boolean {
  return ch === OPEN || ch === BLOCK || (ch >= 'A' && ch <= 'Z');
}

/**
 * Parse crossword grid text into a Grid, or throw a CrosswordSyntaxError
 * that points at the exact line and column of the first problem found.
 *
 * Each non-blank line is one row. Blank lines are ignored, so a grid can
 * be surrounded by other text without extra markup. Every row must be the
 * same width as the first row in the grid.
 */
export function parseGrid(source: string): Grid {
  const rawLines = source.split(/\r\n|\r|\n/);

  const rows: string[][] = [];
  let expectedWidth: number | null = null;
  let widthEstablishedAtLine = 0;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (line.trim() === '') continue;

    const lineNumber = i + 1;

    for (let col = 0; col < line.length; col++) {
      const ch = line[col];
      if (!isValidCellChar(ch)) {
        throw new CrosswordSyntaxError(
          source,
          lineNumber,
          col + 1,
          `unexpected character '${ch}' (expected '.', '#', or a letter A-Z)`
        );
      }
    }

    if (expectedWidth === null) {
      expectedWidth = line.length;
      widthEstablishedAtLine = lineNumber;
    } else if (line.length !== expectedWidth) {
      const column = Math.min(line.length, expectedWidth) + 1;
      throw new CrosswordSyntaxError(
        source,
        lineNumber,
        column,
        `row has ${line.length} column${line.length === 1 ? '' : 's'}, but row at line ` +
          `${widthEstablishedAtLine} established a width of ${expectedWidth}`
      );
    }

    rows.push(line.split(''));
  }

  if (rows.length === 0) {
    throw new CrosswordSyntaxError(
      source,
      1,
      1,
      'grid is empty: expected at least one row made of . # or A-Z characters'
    );
  }

  return new Grid(rows);
}
