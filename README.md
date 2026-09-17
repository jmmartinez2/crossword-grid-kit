# crossword-grid-kit

A small TypeScript library for parsing and validating crossword grids
written as plain text.

## The problem

Crossword grids are usually edited as text: a block of `.` and `#`
characters, one row per line. It's an easy format to write by hand, but
also an easy one to get subtly wrong — a row that's one column short, a
stray character from a bad paste, a row copied from the wrong puzzle. Most
parsers respond to this with something like `Error: invalid grid`, and you
end up counting columns by hand to find the mistake.

This library parses that format and, when something is wrong, reports the
exact line and column, with a source snippet and a caret pointing at the
problem, the way a compiler would.

## Grid format

Each row of the grid is one line of text, made of:

- `.` an open square
- `#` a blocked (black) square
- `A`-`Z` a pre-filled letter, for grids that already have a solution

Blank lines are ignored, so a grid can sit inside a larger text file
without extra markup. Every row must be the same width as the first.

```
..#..
.....
#...#
.....
..#..
```

## Usage

```ts
import { parseGrid } from 'crossword-grid-kit';

const grid = parseGrid(`
..#..
.....
#...#
.....
..#..
`);

grid.width;           // 5
grid.height;          // 5
grid.isBlock(0, 2);   // true
grid.numberAt(0, 0);  // 1
grid.numberAt(1, 2);  // 6 - the down entry that starts under the block at (0, 2)
```

Numbering follows the usual crossword rule: scan the grid left to right,
top to bottom, and assign the next number to any open square that starts
an across entry or a down entry (a run of two or more open squares).

## Entries

`entries()` extracts every across and down word as a `GridEntry`: its
clue number, direction, starting square, length, the list of squares it
covers, and the current text of those squares (pre-filled letters, or
`.` for squares that are still blank).

```ts
grid.acrossEntries()[0];
// {
//   number: 1,
//   direction: 'across',
//   row: 0,
//   col: 0,
//   length: 2,
//   cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }],
//   text: '..',
// }
```

`acrossEntries()` and `downEntries()` filter `entries()` down to one
direction; all three return entries in the same order the grid is
numbered in.

## Symmetry

`isSymmetric()` checks the grid's block pattern for standard 180-degree
rotational symmetry: square `(row, col)` is blocked if and only if square
`(height-1-row, width-1-col)` is blocked. This only looks at where the `#`
squares are, not at any pre-filled letters.

```ts
grid.isSymmetric(); // false for a grid whose blocks don't rotate onto themselves
```

`symmetryViolations()` returns the squares responsible, one per broken
pair (the earlier square in reading order), so a caller can report where
the grid needs fixing instead of just that it's broken:

```ts
grid.symmetryViolations();
// [{ row: 0, col: 4 }] - this square is a block but its rotational
// partner at (height-1, width-5) is open, or vice versa
```

## Entry length

`hasValidEntryLengths()` checks that every entry meets the standard
crossword floor of three letters — most outlets don't count a two-letter
run as a real word, so it's usually a sign of a block placed one square
off from where it should be:

```ts
grid.hasValidEntryLengths(); // false if any entry is 1 or 2 squares long
```

`shortEntries()` returns the offending entries themselves, so a caller
can point at exactly which word is too short instead of just flagging
the grid:

```ts
grid.shortEntries();
// [{ number: 4, direction: 'down', row: 0, col: 3, length: 2, ... }]
```

Both accept an optional `minLength` (default `3`) for callers with a
stricter house style.

## ipuz import and export

`toIpuz()` and `fromIpuz()` convert between a `Grid` and the
[ipuz](http://www.ipuz.org/) crossword interchange format, so a grid can
round-trip through the JSON documents most crossword software reads and
writes.

```ts
import { parseGrid, toIpuz, fromIpuz } from 'crossword-grid-kit';

const grid = parseGrid('..#..\n.....\n#...#\n.....\n..#..');

const document = toIpuz(grid, { title: 'Sample Puzzle', author: 'jmmartinez2' });
// { version: 'http://ipuz.org/v2', kind: ['http://ipuz.org/crossword#1'],
//   dimensions: { width: 5, height: 5 }, puzzle: [...], title: ..., author: ... }

fromIpuz(document).toText() === grid.toText(); // true
```

`toIpuz()` only includes a `solution` field if the grid has at least one
pre-filled letter — an all-open grid has nothing to record there. Clue
text isn't something `Grid` tracks, so pass it in separately if you have
it:

```ts
toIpuz(grid, {
  clues: {
    across: new Map([[1, 'Like some cheese']]),
    down: new Map([[1, 'Not odd']]),
  },
});
```

`fromIpuz()` accepts either a JSON string or an already-parsed object,
and throws an `IpuzFormatError` if the document isn't a crossword (wrong
`kind`), its shape doesn't match its declared `dimensions`, or a cell
uses something other than the plain `"#"` / number / letter forms this
library writes itself. ipuz also allows styled cell objects (for circles,
shading, and so on); those aren't supported, so a document that uses them
is rejected rather than silently misread.

## Checking a solution

`solutionMismatches()` compares a grid against a fully solved answer key
of the same dimensions, square by square, and returns every square where
they disagree — a block pattern mismatch, a square that's still blank, or
a letter that's simply wrong:

```ts
const answerKey = parseGrid('CAT\nARE\nTEN');
const attempt = parseGrid('CAT\nARE\nTEO');

attempt.solutionMismatches(answerKey);
// [{ row: 2, col: 2, expected: 'N', actual: 'O' }]
```

`matchesSolution()` is the same check collapsed to a boolean:

```ts
attempt.matchesSolution(answerKey); // false
```

Both throw a `RangeError` if the answer key isn't the same width and
height as the grid being checked.

## Error messages

A malformed grid throws a `CrosswordSyntaxError`. Its `message` already
contains the formatted snippet, so logging it as-is is normally enough:

```ts
import { parseGrid } from 'crossword-grid-kit';

try {
  parseGrid('..#..\n.....\n#..x#');
} catch (err) {
  console.log(err.message);
}
```

```
crossword grid error at line 3, column 4
3 | #..x#
        ^
unexpected character 'x' (expected '.', '#', or a letter A-Z)
```

The error also carries `line` and `column` as plain numbers, for callers
that want to build their own reporting (an editor gutter marker, for
example) instead of printing the default message.

## Development

`npm test` compiles the library and runs the test suite with Node's built-in
test runner (`node --test`). There's no separate test dependency to install.

## License

MIT, see [LICENSE](LICENSE).
