import assert from 'node:assert/strict';
import { test } from 'node:test';

const {
  ALL_PIECES, BOARD, LEVELS, MARGIN, PICTURES, PIECES, blinks, isRight, looksAlike, makeTray, nextPicture, pieceFor, slotBox,
} = await import('../lib/games/little-builder.js');
const en = (await import('../lib/i18n/locales/en.json', { with: { type: 'json' } })).default;
const tr = (await import('../lib/i18n/locales/tr.json', { with: { type: 'json' } })).default;

const SLOTS = PICTURES.flatMap((each) => each.slots.map((slot) => ({ picture: each.id, slot })));

test('the pieces are exactly the chosen emoji, one per shape and colour pair', () => {
  assert.deepEqual(PIECES, {
    circle: { red: '🔴', orange: '🟠', yellow: '🟡', green: '🟢', blue: '🔵', purple: '🟣', brown: '🟤', black: '⚫', white: '⚪' },
    square: { red: '🟥', orange: '🟧', yellow: '🟨', green: '🟩', blue: '🟦', purple: '🟪', brown: '🟫', black: '⬛', white: '⬜' },
    heart: { red: '❤️', orange: '🧡', yellow: '💛', green: '💚', blue: '💙', purple: '💜', brown: '🤎', black: '🖤', white: '🤍' },
    triangle: { red: '🔺' },
    diamond: { orange: '🔶', blue: '🔷' },
    star: { yellow: '⭐' },
  });
  assert.equal(ALL_PIECES.length, 31);
  assert.equal(new Set(ALL_PIECES.map((piece) => piece.glyph)).size, 31);
  assert.equal(new Set(ALL_PIECES.map((piece) => piece.id)).size, 31);
  assert.equal(pieceFor('triangle', 'blue'), null);
  assert.equal(pieceFor('star', 'red'), null);
  assert.equal(pieceFor('diamond', 'blue')?.glyph, '🔷');
});

test('every shape and colour a piece has has words in both languages', () => {
  for (const piece of ALL_PIECES) {
    for (const key of [`colour.${piece.colour}`, `shape.${piece.shape}`]) assert.ok(en[key] && tr[key], key);
  }
});

test('every slot of every picture asks for a piece that exists', () => {
  for (const { picture, slot } of SLOTS) {
    assert.ok(pieceFor(slot.shape, slot.colour), `${picture}: no ${slot.colour} ${slot.shape}`);
  }
});

test('every picture stays inside the board, and its slots do not overlap', () => {
  for (const each of PICTURES) {
    for (const slot of each.slots) {
      const box = slotBox(slot);
      assert.ok(slot.size >= 12, `${each.id}: a slot is too small to see`);
      assert.ok(box.left >= MARGIN && box.top >= MARGIN && box.right <= BOARD - MARGIN && box.bottom <= BOARD - MARGIN, `${each.id}: ${JSON.stringify(slot)}`);
    }
    for (let a = 0; a < each.slots.length; a += 1) {
      for (let b = a + 1; b < each.slots.length; b += 1) {
        const one = each.slots[a];
        const two = each.slots[b];
        const square = one.shape === 'square' || two.shape === 'square';
        let overlap;
        if (square) {
          const p = slotBox(one);
          const q = slotBox(two);
          overlap = Math.min(p.right, q.right) - Math.max(p.left, q.left) > 0.5 && Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) > 0.5;
        } else {
          overlap = Math.hypot(one.x - two.x, one.y - two.y) < (one.size + two.size) / 2 - 0.5;
        }
        assert.equal(overlap, false, `${each.id}: slots ${a + 1} and ${b + 1} overlap`);
      }
    }
  }
});

test('there are about ten pictures, each of four to nine slots, each named in both languages', () => {
  assert.ok(PICTURES.length >= 10);
  assert.equal(new Set(PICTURES.map((each) => each.id)).size, PICTURES.length);
  for (const each of PICTURES) {
    assert.ok(each.slots.length >= 4 && each.slots.length <= 9, each.id);
    assert.ok(en[`games.little-builder.pic.${each.id}`], `en ${each.id}`);
    assert.ok(tr[`games.little-builder.pic.${each.id}`], `tr ${each.id}`);
  }
});

test('the tray holds the right number of pieces at each level, on each count and not one more or fewer', () => {
  assert.equal(LEVELS.easy.tray, 3);
  assert.equal(LEVELS.normal.tray, 4);
  assert.equal(LEVELS.hard.tray, 5);
  for (const level of Object.keys(LEVELS)) {
    for (const { slot } of SLOTS) {
      const tray = makeTray(level, slot);
      assert.equal(tray.length, LEVELS[level].tray, level);
    }
  }
  assert.equal(makeTray('impossible', SLOTS[0].slot).length, LEVELS.normal.tray);
});

test('a tray has exactly one right piece, no piece twice, and only pieces from the table', () => {
  for (const level of Object.keys(LEVELS)) {
    for (let n = 0; n < 20; n += 1) {
      for (const { slot } of SLOTS) {
        const tray = makeTray(level, slot);
        assert.equal(tray.filter((piece) => isRight(slot, piece)).length, 1);
        assert.equal(new Set(tray.map((piece) => piece.id)).size, tray.length);
        for (const piece of tray) assert.equal(PIECES[piece.shape]?.[piece.colour], piece.glyph);
      }
    }
  }
});

test('look-alikes per level: none on Easy, up to two on Normal (one of each kind when both exist), up to four on Hard', () => {
  for (let n = 0; n < 20; n += 1) {
    for (const { slot } of SLOTS) {
      const right = pieceFor(slot.shape, slot.colour);
      const available = ALL_PIECES.filter((piece) => looksAlike(piece, right));
      const sameColour = available.filter((piece) => piece.colour === right.colour).length;
      const sameShape = available.filter((piece) => piece.shape === right.shape).length;
      const alikeIn = (tray) => tray.filter((piece) => piece.id !== right.id && looksAlike(piece, right));

      assert.equal(alikeIn(makeTray('easy', slot)).length, 0);

      const normal = alikeIn(makeTray('normal', slot));
      assert.equal(normal.length, Math.min(2, available.length));
      if (sameColour > 0 && sameShape > 0) {
        assert.equal(normal.filter((piece) => piece.colour === right.colour).length, 1);
        assert.equal(normal.filter((piece) => piece.shape === right.shape).length, 1);
      }

      assert.equal(alikeIn(makeTray('hard', slot)).length, Math.min(4, available.length));
    }
  }
});

test('a red triangle, which has no other colours, still gets a full tray of red look-alikes on Hard', () => {
  const tray = makeTray('hard', { shape: 'triangle', colour: 'red', x: 50, y: 50, size: 20 });
  assert.equal(tray.length, 5);
  assert.equal(tray.filter((piece) => piece.colour === 'red').length, 4);
  assert.throws(() => makeTray('hard', { shape: 'triangle', colour: 'blue', x: 50, y: 50, size: 20 }), RangeError);
});

test('only the asked shape in the asked colour is right', () => {
  const slot = { shape: 'circle', colour: 'red', x: 50, y: 50, size: 20 };
  assert.equal(isRight(slot, pieceFor('circle', 'red')), true);
  assert.equal(isRight(slot, pieceFor('square', 'red')), false);
  assert.equal(isRight(slot, pieceFor('circle', 'blue')), false);
});

test('the asked slot blinks on Easy and Normal only', () => {
  assert.equal(blinks('easy'), true);
  assert.equal(blinks('normal'), true);
  assert.equal(blinks('hard'), false);
});

test('the next picture is never the same twice in a row', () => {
  let last = null;
  for (let n = 0; n < 200; n += 1) {
    const each = nextPicture(last);
    assert.notEqual(each.id, last);
    last = each.id;
  }
});

test('the Turkish ask puts no ending after a filled-in word', () => {
  assert.equal(tr['games.little-builder.prompt'], 'Hangisi {colour} {shape}?');
  assert.equal(en['games.little-builder.prompt'], 'Find the {colour} {shape}!');
  assert.match(tr['games.little-builder.built'], /\{picture\} /u);
});
