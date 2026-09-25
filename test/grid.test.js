'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseGrid, CrosswordSyntaxError } = require('../dist/index.js');

function captureError(fn) {
  try {
    fn();
  } catch (err) {
    return err;
  }
  throw new Error('expected function to throw');
}

const SAMPLE = ['..#..', '.....', '#...#', '.....', '..#..'].join('\n');

test('parses width and height', () => {
  const grid = parseGrid(SAMPLE);
  assert.equal(grid.width, 5);
  assert.equal(grid.height, 5);
});

test('reports block and letter squares', () => {
  const grid = parseGrid(SAMPLE);
  assert.equal(grid.isBlock(0, 2), true);
  assert.equal(grid.isBlock(0, 0), false);
  assert.equal(grid.letterAt(0, 0), undefined);
  assert.equal(parseGrid('CAT\nARE\nTEN').letterAt(0, 0), 'C');
});

test('ignores blank lines around the grid', () => {
  const grid = parseGrid(`\n\n${SAMPLE}\n\n`);
  assert.equal(grid.height, 5);
  assert.equal(grid.toText(), SAMPLE);
});

test('numbers squares per the README example', () => {
  const grid = parseGrid(SAMPLE);
  assert.equal(grid.numberAt(0, 0), 1);
  assert.equal(grid.numberAt(1, 2), 6);
  assert.equal(grid.numberAt(1, 1), undefined);
});

test('extracts across entries in numbering order', () => {
  const grid = parseGrid(SAMPLE);
  const across = grid.acrossEntries();
  assert.deepEqual(
    across.map((entry) => entry.number),
    [1, 3, 5, 7, 8, 10, 11]
  );
  assert.deepEqual(across[0], {
    number: 1,
    direction: 'across',
    row: 0,
    col: 0,
    length: 2,
    cells: [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ],
    text: '..',
  });
});

test('extracts down entries separately from across entries', () => {
  const grid = parseGrid(SAMPLE);
  const down = grid.downEntries();
  assert.ok(down.every((entry) => entry.direction === 'down'));
  assert.equal(down.length + grid.acrossEntries().length, grid.entries().length);
});

test('entries() interleaves across before down at a shared number', () => {
  const grid = parseGrid(SAMPLE);
  const entries = grid.entries();
  const firstAtEachNumber = new Map();
  for (const entry of entries) {
    if (!firstAtEachNumber.has(entry.number)) firstAtEachNumber.set(entry.number, entry.direction);
  }
  assert.equal(firstAtEachNumber.get(1), 'across');
});

test('isSymmetric is true for a rotationally symmetric grid', () => {
  assert.equal(parseGrid(SAMPLE).isSymmetric(), true);
});

test('isSymmetric is false and violations point at the broken square', () => {
  const grid = parseGrid(['#....', '.....', '.....', '.....', '.....'].join('\n'));
  assert.equal(grid.isSymmetric(), false);
  assert.deepEqual(grid.symmetryViolations(), [{ row: 0, col: 0 }]);
});

test('symmetryViolations reports one entry per broken pair, not two', () => {
  const grid = parseGrid(['#...#', '.....', '.....', '.....', '.....'].join('\n'));
  // (0,0)/(4,4) and (0,4)/(4,0) are both mismatched pairs; each should
  // contribute exactly one violation (the earlier square), for two total.
  const violations = grid.symmetryViolations();
  assert.deepEqual(violations, [
    { row: 0, col: 0 },
    { row: 0, col: 4 },
  ]);
});

test('hasValidEntryLengths flags entries shorter than the default floor of 3', () => {
  const grid = parseGrid('..\n..');
  assert.equal(grid.hasValidEntryLengths(), false);
  assert.equal(grid.shortEntries().length, grid.entries().length);
  assert.ok(grid.shortEntries().every((entry) => entry.length === 2));
});

test('hasValidEntryLengths accepts a custom minLength', () => {
  const grid = parseGrid('..\n..');
  assert.equal(grid.hasValidEntryLengths(2), true);
  assert.equal(grid.shortEntries(2).length, 0);
});

test('solutionMismatches finds letter, blank, and block mismatches', () => {
  const answerKey = parseGrid('CAT\nARE\nTEN');
  const attempt = parseGrid('CAT\nAR.\nTEO');
  assert.deepEqual(attempt.solutionMismatches(answerKey), [
    { row: 1, col: 2, expected: 'E', actual: '.' },
    { row: 2, col: 2, expected: 'N', actual: 'O' },
  ]);
});

test('matchesSolution is true only when every square agrees', () => {
  const answerKey = parseGrid('CAT\nARE\nTEN');
  assert.equal(parseGrid('CAT\nARE\nTEN').matchesSolution(answerKey), true);
  assert.equal(parseGrid('CAT\nARE\nTEO').matchesSolution(answerKey), false);
});

test('solutionMismatches rejects an answer key of the wrong size', () => {
  const grid = parseGrid('CAT\nARE\nTEN');
  const wrongSize = parseGrid('CA\nAR');
  assert.throws(() => grid.solutionMismatches(wrongSize), RangeError);
});

test('isBlock, letterAt, and numberAt all reject out-of-bounds coordinates', () => {
  const grid = parseGrid(SAMPLE);
  assert.throws(() => grid.isBlock(5, 0), RangeError);
  assert.throws(() => grid.letterAt(0, 5), RangeError);
  assert.throws(() => grid.numberAt(-1, 0), RangeError);
  assert.throws(() => grid.numberAt(0, 5), RangeError);
});

test('rejects an unexpected character with line and column', () => {
  const err = captureError(() => parseGrid('..#..\n.....\n#..x#'));
  assert.ok(err instanceof CrosswordSyntaxError);
  assert.equal(err.line, 3);
  assert.equal(err.column, 4);
  assert.match(err.message, /unexpected character 'x'/);
});

test('rejects a row whose width does not match the first row', () => {
  const err = captureError(() => parseGrid('...\n..'));
  assert.ok(err instanceof CrosswordSyntaxError);
  assert.equal(err.line, 2);
  assert.match(err.message, /established a width of 3/);
});

test('rejects an empty grid', () => {
  const err = captureError(() => parseGrid('   \n\n'));
  assert.ok(err instanceof CrosswordSyntaxError);
  assert.equal(err.line, 1);
  assert.equal(err.column, 1);
});
