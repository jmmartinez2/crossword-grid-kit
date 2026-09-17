'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseGrid, toIpuz, fromIpuz, IpuzFormatError } = require('../dist/index.js');

const SAMPLE = '..#..\n.....\n#...#\n.....\n..#..';

test('toIpuz sets version, kind, and dimensions', () => {
  const document = toIpuz(parseGrid(SAMPLE));
  assert.equal(document.version, 'http://ipuz.org/v2');
  assert.deepEqual(document.kind, ['http://ipuz.org/crossword#1']);
  assert.deepEqual(document.dimensions, { width: 5, height: 5 });
});

test('toIpuz writes clue numbers and blocks into puzzle cells', () => {
  const document = toIpuz(parseGrid(SAMPLE));
  assert.equal(document.puzzle[0][0], 1);
  assert.equal(document.puzzle[0][2], '#');
  assert.equal(document.puzzle[1][1], 0);
});

test('toIpuz omits solution for a grid with no pre-filled letters', () => {
  const document = toIpuz(parseGrid(SAMPLE));
  assert.equal('solution' in document, false);
});

test('toIpuz includes solution once any letter is pre-filled', () => {
  const document = toIpuz(parseGrid('CAT\nARE\nTEN'));
  assert.deepEqual(document.solution, [
    ['C', 'A', 'T'],
    ['A', 'R', 'E'],
    ['T', 'E', 'N'],
  ]);
});

test('toIpuz includes title, author, and sorted clues only when given', () => {
  const grid = parseGrid(SAMPLE);
  const bare = toIpuz(grid);
  assert.equal('title' in bare, false);
  assert.equal('author' in bare, false);
  assert.equal('clues' in bare, false);

  const withOptions = toIpuz(grid, {
    title: 'Sample Puzzle',
    author: 'jmmartinez2',
    clues: {
      across: new Map([[5, 'Fifth across'], [1, 'First across']]),
      down: new Map([[1, 'First down']]),
    },
  });
  assert.equal(withOptions.title, 'Sample Puzzle');
  assert.equal(withOptions.author, 'jmmartinez2');
  assert.deepEqual(withOptions.clues.Across, [[1, 'First across'], [5, 'Fifth across']]);
  assert.deepEqual(withOptions.clues.Down, [[1, 'First down']]);
});

test('fromIpuz(toIpuz(grid)) round-trips back to the same text', () => {
  const grid = parseGrid(SAMPLE);
  assert.equal(fromIpuz(toIpuz(grid)).toText(), grid.toText());

  const solved = parseGrid('CAT\nARE\nTEN');
  assert.equal(fromIpuz(toIpuz(solved)).toText(), solved.toText());
});

test('fromIpuz accepts a JSON string as well as a parsed object', () => {
  const grid = parseGrid(SAMPLE);
  const json = JSON.stringify(toIpuz(grid));
  assert.equal(fromIpuz(json).toText(), grid.toText());
});

test('fromIpuz rejects malformed JSON', () => {
  assert.throws(() => fromIpuz('{not json'), IpuzFormatError);
});

test('fromIpuz rejects a document whose kind is not a crossword', () => {
  const document = toIpuz(parseGrid(SAMPLE));
  const wrongKind = { ...document, kind: ['http://ipuz.org/sudoku#1'] };
  assert.throws(() => fromIpuz(wrongKind), IpuzFormatError);
});

test('fromIpuz rejects missing or malformed dimensions', () => {
  const document = toIpuz(parseGrid(SAMPLE));
  const { dimensions, ...withoutDimensions } = document;
  assert.throws(() => fromIpuz(withoutDimensions), IpuzFormatError);
  assert.throws(() => fromIpuz({ ...document, dimensions: { width: '5', height: 5 } }), IpuzFormatError);
});

test('fromIpuz rejects a puzzle array with the wrong number of rows', () => {
  const document = toIpuz(parseGrid(SAMPLE));
  assert.throws(() => fromIpuz({ ...document, puzzle: document.puzzle.slice(1) }), IpuzFormatError);
});

test('fromIpuz rejects a puzzle row with the wrong number of columns', () => {
  const document = toIpuz(parseGrid(SAMPLE));
  const puzzle = document.puzzle.map((row, i) => (i === 0 ? row.slice(1) : row));
  assert.throws(() => fromIpuz({ ...document, puzzle }), IpuzFormatError);
});

test('fromIpuz rejects a cell value other than "#" or a number', () => {
  const document = toIpuz(parseGrid(SAMPLE));
  const puzzle = document.puzzle.map((row, i) => (i === 0 ? [...row.slice(0, 1), { style: {} }, ...row.slice(2)] : row));
  assert.throws(() => fromIpuz({ ...document, puzzle }), IpuzFormatError);
});

test('fromIpuz rejects a solution cell that is not a single letter A-Z', () => {
  const document = toIpuz(parseGrid('CAT\nARE\nTEN'));
  const solution = document.solution.map((row, i) => (i === 0 ? ['1', row[1], row[2]] : row));
  assert.throws(() => fromIpuz({ ...document, solution }), IpuzFormatError);
});

test('fromIpuz rejects styled cell objects instead of plain values', () => {
  const document = toIpuz(parseGrid(SAMPLE));
  const puzzle = document.puzzle.map((row, i) =>
    i === 0 ? [{ cell: 1, style: { shapebg: 'circle' } }, ...row.slice(1)] : row
  );
  assert.throws(() => fromIpuz({ ...document, puzzle }), IpuzFormatError);
});

test('fromIpuz treats a missing or malformed solution array as fully unsolved', () => {
  const document = toIpuz(parseGrid(SAMPLE));
  const { solution, ...withoutSolution } = document;
  const grid = fromIpuz(withoutSolution);
  assert.equal(grid.toText(), parseGrid(SAMPLE).toText());
});
