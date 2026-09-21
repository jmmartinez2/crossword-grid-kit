import { Grid, SolutionMismatch } from './grid';
import { formatSnippet } from './snippet';

/**
 * Render solutionMismatches() as compiler-style diagnostics: one block per
 * mismatch, each showing the offending row of `grid` with a caret under the
 * column in question, in the same style CrosswordSyntaxError uses for parse
 * errors. Rows and columns are reported 1-indexed, matching that error's
 * `line`/`column` convention.
 */
export function formatMismatches(grid: Grid, mismatches: readonly SolutionMismatch[]): string {
  if (mismatches.length === 0) return 'no mismatches';

  const lines = grid.toText().split('\n');

  return mismatches
    .map((mismatch) => {
      const line = mismatch.row + 1;
      const column = mismatch.col + 1;
      const text = lines[mismatch.row] ?? '';

      return [
        `row ${line}, column ${column}`,
        formatSnippet(line, text, column),
        `expected '${mismatch.expected}', got '${mismatch.actual}'`,
      ].join('\n');
    })
    .join('\n\n');
}
