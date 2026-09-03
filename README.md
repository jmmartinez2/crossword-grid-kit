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

## What's not here yet

There's no import or export to other puzzle formats (ipuz, for a start)
yet, and no way to check a filled-in grid against an answer key.

## License

MIT, see [LICENSE](LICENSE).
