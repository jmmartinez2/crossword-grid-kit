'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { CrosswordSyntaxError } = require('../dist/index.js');

test('formats the README example exactly', () => {
  const source = '..#..\n.....\n#..x#';
  const err = new CrosswordSyntaxError(source, 3, 4, "unexpected character 'x' (expected '.', '#', or a letter A-Z)");
  const gutterLine = '3 | #..x#';
  const caretLine = ' '.repeat(gutterLine.indexOf('x')) + '^';

  assert.equal(
    err.message,
    [
      'crossword grid error at line 3, column 4',
      gutterLine,
      caretLine,
      "unexpected character 'x' (expected '.', '#', or a letter A-Z)",
    ].join('\n')
  );
});

test('carries line, column, and detail as plain fields', () => {
  const err = new CrosswordSyntaxError('#..x#', 1, 4, 'bad character');
  assert.equal(err.name, 'CrosswordSyntaxError');
  assert.equal(err.line, 1);
  assert.equal(err.column, 4);
  assert.equal(err.detail, 'bad character');
  assert.ok(err instanceof Error);
});

test('pads the caret to line up under a multi-digit line number', () => {
  const lines = Array.from({ length: 10 }, () => '.....');
  lines[9] = '#..x#';
  const source = lines.join('\n');
  const err = new CrosswordSyntaxError(source, 10, 4, 'bad character');

  const messageLines = err.message.split('\n');
  const gutterLine = messageLines[1];
  const caretLine = messageLines[2];
  const caretColumn = caretLine.indexOf('^');
  const markedChar = gutterLine[caretColumn];

  assert.equal(gutterLine, '10 | #..x#');
  assert.equal(markedChar, 'x');
});
