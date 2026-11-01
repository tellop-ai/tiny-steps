'use client';

/**
 * Which component plays which game. One import per game, in the catalog's order
 * (`lib/play/catalog.js`); each game owns its own file under `app/_games/`.
 */

import ColourMuncher from '../_games/colour-muncher.jsx';
import RainbowMaker from '../_games/rainbow-maker.jsx';
import AnimalCount from '../_games/animal-count.jsx';
import NumberHunt from '../_games/number-hunt.jsx';
import NumberPond from '../_games/number-pond.jsx';
import HungryHedgehog from '../_games/hungry-hedgehog.jsx';
import DotToDot from '../_games/dot-to-dot.jsx';
import NumberTracing from '../_games/number-tracing.jsx';
import LittleBuilder from '../_games/little-builder.jsx';
import ShapeBelt from '../_games/shape-belt.jsx';
import ShapeBox from '../_games/shape-box.jsx';
import ToyRoom from '../_games/toy-room.jsx';
import LetterTracing from '../_games/letter-tracing.jsx';
import LetterMuncher from '../_games/letter-muncher.jsx';
import LetterFlowers from '../_games/letter-flowers.jsx';

/** @type {Readonly<Record<string, (props: { level: string, locale: string, play: object, over: boolean }) => any>>} */
export const GAME_COMPONENTS = Object.freeze({
  'colour-muncher': ColourMuncher,
  'rainbow-maker': RainbowMaker,
  'animal-count': AnimalCount,
  'number-hunt': NumberHunt,
  'number-pond': NumberPond,
  'hungry-hedgehog': HungryHedgehog,
  'dot-to-dot': DotToDot,
  'number-tracing': NumberTracing,
  'little-builder': LittleBuilder,
  'shape-belt': ShapeBelt,
  'shape-box': ShapeBox,
  'toy-room': ToyRoom,
  'letter-tracing': LetterTracing,
  'letter-muncher': LetterMuncher,
  'letter-flowers': LetterFlowers,
});
