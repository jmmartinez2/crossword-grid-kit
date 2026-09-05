import { Grid } from './grid';

/**
 * An ipuz document (http://www.ipuz.org/) that doesn't describe a
 * crossword grid this library can read: wrong puzzle kind, a shape that
 * doesn't match its declared dimensions, or a cell value outside the
 * plain "#" / number / letter forms this library understands. ipuz also
 * allows styled cell objects (for circles, shading, and the like); those
 * aren't supported here, so a document that uses them fails the same way.
 */
export class IpuzFormatError extends Error {
  constructor(detail: string) {
    super(`invalid ipuz document: ${detail}`);
    this.name = 'IpuzFormatError';
  }
}

export interface IpuzClueList {
  readonly across?: ReadonlyMap<number, string>;
  readonly down?: ReadonlyMap<number, string>;
}

export interface IpuzExportOptions {
  readonly title?: string;
  readonly author?: string;
  readonly clues?: IpuzClueList;
}

type IpuzPuzzleCell = number | '#';

export interface IpuzDocument {
  readonly version: string;
  readonly kind: string[];
  readonly dimensions: { readonly width: number; readonly height: number };
  readonly puzzle: IpuzPuzzleCell[][];
  readonly solution?: string[][];
  readonly title?: string;
  readonly author?: string;
  readonly clues?: { readonly Across: [number, string][]; readonly Down: [number, string][] };
}

const IPUZ_VERSION = 'http://ipuz.org/v2';
const IPUZ_CROSSWORD_KIND = 'http://ipuz.org/crossword#1';

/**
 * Convert a Grid to an ipuz crossword document. The `solution` field is
 * only included if the grid has at least one pre-filled letter, since an
 * all-open grid has nothing to record there. Clue text isn't tracked by
 * Grid itself, so pass it through `options.clues` if the caller has it.
 */
export function toIpuz(grid: Grid, options: IpuzExportOptions = {}): IpuzDocument {
  const puzzle: IpuzPuzzleCell[][] = [];
  const solution: string[][] = [];
  let solved = false;

  for (let row = 0; row < grid.height; row++) {
    const puzzleRow: IpuzPuzzleCell[] = [];
    const solutionRow: string[] = [];

    for (let col = 0; col < grid.width; col++) {
      if (grid.isBlock(row, col)) {
        puzzleRow.push('#');
        solutionRow.push('#');
        continue;
      }

      puzzleRow.push(grid.numberAt(row, col) ?? 0);

      const letter = grid.letterAt(row, col);
      if (letter !== undefined) solved = true;
      solutionRow.push(letter ?? '');
    }

    puzzle.push(puzzleRow);
    solution.push(solutionRow);
  }

  return {
    version: IPUZ_VERSION,
    kind: [IPUZ_CROSSWORD_KIND],
    dimensions: { width: grid.width, height: grid.height },
    puzzle,
    ...(solved ? { solution } : {}),
    ...(options.title !== undefined ? { title: options.title } : {}),
    ...(options.author !== undefined ? { author: options.author } : {}),
    ...(options.clues !== undefined
      ? {
          clues: {
            Across: [...(options.clues.across ?? new Map())].sort((a, b) => a[0] - b[0]),
            Down: [...(options.clues.down ?? new Map())].sort((a, b) => a[0] - b[0]),
          },
        }
      : {}),
  };
}

/**
 * Parse an ipuz crossword document (as a JSON string, or already-parsed
 * object) back into a Grid. Only the plain cell forms this library itself
 * writes are understood: "#" for a block, a number for an open square
 * (the clue number, or 0 if it doesn't start an entry), and, in
 * `solution`, a single letter A-Z or an empty value for an unsolved
 * square.
 */
export function fromIpuz(input: string | Record<string, unknown>): Grid {
  const document = typeof input === 'string' ? parseJson(input) : input;

  const kind = document.kind;
  if (!Array.isArray(kind) || !kind.some((entry) => typeof entry === 'string' && entry.startsWith('http://ipuz.org/crossword'))) {
    throw new IpuzFormatError('"kind" does not identify a crossword puzzle');
  }

  const dimensions = document.dimensions as { width?: unknown; height?: unknown } | undefined;
  if (!dimensions || typeof dimensions.width !== 'number' || typeof dimensions.height !== 'number') {
    throw new IpuzFormatError('missing or malformed "dimensions"');
  }
  const { width, height } = dimensions;

  const puzzle = document.puzzle;
  if (!Array.isArray(puzzle) || puzzle.length !== height) {
    throw new IpuzFormatError(
      `"puzzle" must be an array of ${height} row${height === 1 ? '' : 's'}, got ` +
        `${Array.isArray(puzzle) ? `${puzzle.length}` : typeof puzzle}`
    );
  }

  const solution = document.solution;
  if (solution !== undefined && (!Array.isArray(solution) || solution.length !== height)) {
    throw new IpuzFormatError(`"solution" must be an array of ${height} row${height === 1 ? '' : 's'}`);
  }

  const rows: string[][] = [];

  for (let row = 0; row < height; row++) {
    const puzzleRow = puzzle[row];
    if (!Array.isArray(puzzleRow) || puzzleRow.length !== width) {
      throw new IpuzFormatError(`row ${row} of "puzzle" must have ${width} column${width === 1 ? '' : 's'}`);
    }

    const solutionRow: unknown = Array.isArray(solution) ? solution[row] : undefined;
    const rowCells: string[] = [];

    for (let col = 0; col < width; col++) {
      const cell = puzzleRow[col];
      if (cell !== '#' && typeof cell !== 'number') {
        throw new IpuzFormatError(
          `puzzle cell at row ${row}, column ${col} must be "#" or a number, got ${JSON.stringify(cell)}`
        );
      }

      if (cell === '#') {
        rowCells.push('#');
        continue;
      }

      const solutionCell = Array.isArray(solutionRow) ? solutionRow[col] : undefined;
      if (solutionCell === undefined || solutionCell === null || solutionCell === '') {
        rowCells.push('.');
        continue;
      }

      if (typeof solutionCell !== 'string' || solutionCell.length !== 1 || solutionCell < 'A' || solutionCell > 'Z') {
        throw new IpuzFormatError(
          `solution cell at row ${row}, column ${col} is ${JSON.stringify(solutionCell)}, ` +
            `expected a single letter A-Z or an empty value`
        );
      }

      rowCells.push(solutionCell);
    }

    rows.push(rowCells);
  }

  return new Grid(rows);
}

function parseJson(source: string): Record<string, unknown> {
  try {
    return JSON.parse(source) as Record<string, unknown>;
  } catch (err) {
    throw new IpuzFormatError(`not valid JSON (${(err as Error).message})`);
  }
}
