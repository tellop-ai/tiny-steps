/**
 * A figure's settings can never carry page code (`AGENTS.md` rule 6a).
 *
 * `components/ui/chart.jsx` writes each setting's name and colour into a
 * `<style>` element, because that is how a figure is coloured at all. A name
 * or a colour that a person typed, or that came back out of stored notes,
 * could end that element and start a script that runs as whoever opens the
 * page. So the chart drops any name, colour or chart id that could end the
 * element or its rule, and this check draws the real chart on the server with
 * such values and reads what it wrote.
 *
 * The chart is written in JSX, which Node does not read, so this check turns
 * it into plain JavaScript with the compiler Next itself builds the app with
 * (already installed with `next`). Nothing here reaches the network.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = new URL('../', import.meta.url);
const swc = require('next/dist/build/swc/index.js');
await swc.loadBindings();

registerHooks({
  resolve(specifier, context, nextResolve) {
    // `@/` is the app's own folder (`jsconfig.json`); its plain modules are `.js`.
    if (specifier.startsWith('@/')) return nextResolve(new URL(`${specifier.slice(2)}.js`, root).href, context);
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (!url.endsWith('.jsx')) return nextLoad(url, context);
    const { code } = swc.transformSync(readFileSync(fileURLToPath(url), 'utf8'), {
      filename: fileURLToPath(url),
      jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } }, target: 'es2022' },
      module: { type: 'es6' },
    });
    return { format: 'module', source: code, shortCircuit: true };
  },
});

const { createElement } = await import('react');
const { renderToString } = await import('react-dom/server');
const { ChartContainer, ChartStyle } = await import('../components/ui/chart.jsx');

/** @param {Record<string, unknown>} props */
function draw(props) {
  return renderToString(createElement(ChartContainer, props, createElement('div')));
}

/** The page holds no script, one style element, and nothing in it that could end it early. */
function assertNoPageCode(page) {
  assert.equal(page.includes('<script'), false, page);
  assert.equal(page.split('<style').length, 2, page);
  assert.equal(page.split('</style>').length, 2, page);
  assert.equal(page.slice(page.indexOf('<style>') + '<style>'.length, page.indexOf('</style>')).includes('<'), false, page);
}

const HOSTILE = 'x</style><script>alert(1)</script>';

test('a name or a colour that could end the style element is left out', () => {
  const page = draw({
    config: {
      [HOSTILE]: { label: 'typed', color: 'red' },
      safe: { label: 'typed', color: `red;}</style><script>alert(2)</script>` },
      themed: { label: 'typed', theme: { light: 'blue', dark: '"><script>alert(3)</script>' } },
      kept: { label: 'kept', color: 'var(--chart-1)' },
    },
  });
  assertNoPageCode(page);
  assert.match(page, /--color-kept: var\(--chart-1\);/u);
  assert.match(page, /--color-themed: blue;/u);
  assert.doesNotMatch(page, /--color-safe:/u);
});

test('a chart id that could end the style element is left out', () => {
  const page = draw({ id: HOSTILE, config: { kept: { label: 'kept', color: 'var(--chart-2)' } } });
  assertNoPageCode(page);
  assert.match(page, /--color-kept: var\(--chart-2\);/u);
  // The style piece is offered on its own too: an unsafe id there draws no style at all.
  const alone = renderToString(createElement(ChartStyle, { id: HOSTILE, config: { kept: { color: 'red' } } }));
  assert.equal(alone, '');
  assert.match(renderToString(createElement(ChartStyle, { id: 'chart-kept', config: { kept: { color: 'red' } } })), /--color-kept: red;/u);
});

test('a name with a character outside letters, digits, - and _ is left out, and so is one longer than 64', () => {
  const page = draw({
    config: {
      'a b': { color: 'red' }, 'a.b': { color: 'red' }, [`k${'x'.repeat(64)}`]: { color: 'red' },
      [`k${'x'.repeat(63)}`]: { color: 'green' }, 'Kept_2-b': { color: 'blue' },
    },
  });
  assert.doesNotMatch(page, /--color-a[ .]b/u);
  assert.match(page, new RegExp(`--color-k${'x'.repeat(63)}: green;`, 'u'));
  assert.doesNotMatch(page, new RegExp(`--color-k${'x'.repeat(64)}:`, 'u'));
  assert.match(page, /--color-Kept_2-b: blue;/u);
});

test('a colour holding any character that could end its rule or the element is left out', () => {
  for (const mark of ['<', '>', '{', '}', ';', '"', "'", '`']) {
    const page = draw({ config: { bad: { color: `red${mark}` }, kept: { color: 'red' } } });
    assert.doesNotMatch(page, /--color-bad:/u, mark);
    assert.match(page, /--color-kept: red;/u, mark);
  }
});

test('a colour holding an escape, a comment, a web address or an unbalanced bracket is left out', () => {
  // A comment opener would hide every later series and the whole dark rule.
  for (const color of ['red\\3c', '\\', 'red /*', '/* x */ red', 'red */', 'url(https://example.invalid/a.png)', 'URL(x)', 'Url(x)', 'rgb(0 0 0', 'red)', ')(', 'var(--x))', 'hsl((var(--chart-1))']) {
    const page = draw({ config: { bad: { color }, kept: { color: 'red' } } });
    assert.doesNotMatch(page, /--color-bad:/u, color);
    assert.match(page, /--color-kept: red;/u, color);
  }
});

test('two different chart ids never become one, so one chart never repaints another', () => {
  // Turkish letters that a plain strip would drop, ids with no Latin letter at all, and an id spelled like an escape.
  const ids = ['kaş', 'kaç', 'ka', '数据', '表格', '', 'ç', '_e7_', 'a_b', 'a-b', '\u{1F600}', '\u{1F601}'];
  const drawn = ids.map((id) => {
    const page = draw({ id, config: { kept: { color: 'red' } } });
    assertNoPageCode(page);
    const chart = /data-chart="([^"]*)"/u.exec(page)?.[1];
    assert.match(chart, /^chart-[A-Za-z0-9_-]*$/u, id);
    assert.ok(page.includes(`[data-chart=${chart}] {`), id);
    return chart;
  });
  assert.equal(new Set(drawn).size, ids.length, drawn.join(' '));
});

test('every ordinary way of writing a colour still passes', () => {
  for (const color of ['hsl(var(--chart-1))', 'oklch(0.7 0.12 200)', 'oklch(from var(--chart-1) l c h)', '#abc', 'var(--x)', 'rgb(0 0 0 / 50%)', 'hsl(calc(var(--h) * 2) 50% 50%)', 'color-mix(in oklch, var(--chart-2) 40%, white)']) {
    const page = draw({ config: { kept: { color } } });
    assert.ok(page.includes(`--color-kept: ${color};`), color);
  }
});
