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
 * A single square where a grid disagrees with an answer key: either the
 * block pattern doesn't line up, or an open square holds the wrong letter
 * (or none yet). `expected` and `actual` are `#` for a block, `.` for an
 * open square with no letter, or the letter in question.
 */
export interface SolutionMismatch {
  readonly row: number;
  readonly col: number;
  readonly expected: string;
  readonly actual: string;
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
    this.assertInBounds(row, col);
    return this.numbers[row][col] ?? undefined;
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

  /**
   * Entries shorter than `minLength` (default 3, the standard crossword
   * floor — a two-letter entry isn't considered a real word by most
   * outlets). Returned in the same order as `entries()`.
   */
  shortEntries(minLength = MIN_ENTRY_LENGTH): readonly GridEntry[] {
    return this.entryList.filter((entry) => entry.length < minLength);
  }

  /** Whether every entry meets `minLength` (default 3). */
  hasValidEntryLengths(minLength = MIN_ENTRY_LENGTH): boolean {
    return this.shortEntries(minLength).length === 0;
  }

  /**
   * The squares where this grid disagrees with a fully solved answer key
   * of the same dimensions: a block pattern mismatch, an open square
   * that's still blank, or a filled-in letter that doesn't match. Empty
   * if the grid is completely and correctly solved.
   */
  solutionMismatches(answerKey: Grid): readonly SolutionMismatch[] {
    if (answerKey.width !== this.width || answerKey.height !== this.height) {
      throw new RangeError(
        `answer key is ${answerKey.height}x${answerKey.width}, but grid is ${this.height}x${this.width}`
      );
    }

    const mismatches: SolutionMismatch[] = [];

    for (let row = 0; row < this.height; row++) {
      for (let col = 0; col < this.width; col++) {
        const expectedBlock = answerKey.isBlock(row, col);
        const actualBlock = this.isBlock(row, col);

        if (expectedBlock !== actualBlock) {
          mismatches.push({
            row,
            col,
            expected: expectedBlock ? BLOCK : answerKey.letterAt(row, col) ?? OPEN,
            actual: actualBlock ? BLOCK : this.letterAt(row, col) ?? OPEN,
          });
          continue;
        }

        if (expectedBlock) continue;

        const expectedLetter = answerKey.letterAt(row, col) ?? OPEN;
        const actualLetter = this.letterAt(row, col) ?? OPEN;
        if (expectedLetter !== actualLetter) {
          mismatches.push({ row, col, expected: expectedLetter, actual: actualLetter });
        }
      }
    }

    return mismatches;
  }

  /**
   * Whether this grid is completely filled in and matches the given
   * answer key, square for square.
   */
  matchesSolution(answerKey: Grid): boolean {
    return this.solutionMismatches(answerKey).length === 0;
  }

  private cellAt(row: number, col: number): string {
    this.assertInBounds(row, col);
    return this.cells[row][col];
  }

  private assertInBounds(row: number, col: number): void {
    if (row < 0 || row >= this.height || col < 0 || col >= this.width) {
      throw new RangeError(`cell (${row}, ${col}) is outside the ${this.height}x${this.width} grid`);
    }
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
const MIN_ENTRY_LENGTH = 3;

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
