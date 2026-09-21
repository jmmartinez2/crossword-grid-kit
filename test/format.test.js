'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseGrid, formatMismatches } = require('../dist/index.js');

// Parses one "row N, column N / N | text / <caret> / detail" block back into
// its parts, checking the caret lines up under the reported column without
// hand-counting spaces in the test itself.
function parseBlock(block) {
  const [header, gutterLine, caretLine, detail] = block.split('\n');
  const [, line, column] = /^row (\d+), column (\d+)$/.exec(header);
  const separator = ' | ';
  const textStart = gutterLine.indexOf(separator) + separator.length;

  assert.equal(caretLine, ' '.repeat(textStart + Number(column) - 1) + '^');

  return { line: Number(line), column: Number(column), text: gutterLine.slice(textStart), detail };
}

test('formatMismatches reports no mismatches for an empty list', () => {
  assert.equal(formatMismatches(parseGrid('CAT\nARE\nTEN'), []), 'no mismatches');
});

test('formatMismatches renders one diagnostic block per mismatch', () => {
  const answerKey = parseGrid('CAT\nARE\nTEN');
  const attempt = parseGrid('CAT\nAR.\nTEO');
  const mismatches = attempt.solutionMismatches(answerKey);

  const blocks = formatMismatches(attempt, mismatches).split('\n\n').map(parseBlock);

  assert.deepEqual(blocks, [
    { line: 2, column: 3, text: 'AR.', detail: "expected 'E', got '.'" },
    { line: 3, column: 3, text: 'TEO', detail: "expected 'N', got 'O'" },
  ]);
});

test('formatMismatches points at a block mismatch too', () => {
  const answerKey = parseGrid('CAT\nARE\nTEN');
  const attempt = parseGrid('CAT\nAR#\nTEN');
  const mismatches = attempt.solutionMismatches(answerKey);

  const [block] = formatMismatches(attempt, mismatches).split('\n\n').map(parseBlock);
  assert.deepEqual(block, { line: 2, column: 3, text: 'AR#', detail: "expected 'E', got '#'" });
});
