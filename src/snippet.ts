/**
 * Render a source line with a caret pointing at a column, the two-line
 * block every compiler-style diagnostic in this library is built from.
 */
export function formatSnippet(line: number, text: string, column: number): string {
  const gutter = String(line);
  const prefixLength = gutter.length + 3; // "<gutter> | "
  const caret = ' '.repeat(prefixLength + column - 1) + '^';
  return [`${gutter} | ${text}`, caret].join('\n');
}
