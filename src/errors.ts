/**
 * A syntax error found while parsing crossword grid text.
 *
 * The message is pre-formatted with a source snippet and a caret pointing at
 * the offending column, in the style of a compiler diagnostic, because the
 * whole point of reporting line/column at all is to let someone jump
 * straight to the mistake instead of counting characters by hand.
 */
export class CrosswordSyntaxError extends Error {
  readonly line: number;
  readonly column: number;
  readonly detail: string;

  constructor(source: string, line: number, column: number, detail: string) {
    super(formatMessage(source, line, column, detail));
    this.name = 'CrosswordSyntaxError';
    this.line = line;
    this.column = column;
    this.detail = detail;
  }
}

function formatMessage(source: string, line: number, column: number, detail: string): string {
  const lines = source.split(/\r\n|\r|\n/);
  const text = lines[line - 1] ?? '';
  const gutter = String(line);
  const prefixLength = gutter.length + 3; // "<gutter> | "
  const caret = ' '.repeat(prefixLength + column - 1) + '^';

  return [
    `crossword grid error at line ${line}, column ${column}`,
    `${gutter} | ${text}`,
    caret,
    detail,
  ].join('\n');
}
