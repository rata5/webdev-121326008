// The parts of the UI checklist (docs/UI.md) that can be checked by reading the files.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

describe('R8 every size comes from the stylesheet', () => {
  it('R8 no page or script sets a style inline', () => {
    const files = [
      ...readdirSync('src/pages').map((name) => `src/pages/${name}`),
      ...readdirSync('public').filter((name) => name.endsWith('.js')).map((name) => `public/${name}`),
    ];
    expect(files.filter((file) => /style="|\.style\./.test(readFileSync(file, 'utf8')))).toEqual([]);
  });
});

// WCAG contrast ratio of two #rrggbb colours.
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
};

describe('R9 the focus ring can be seen', () => {
  it('R9 the focus colour has at least 3:1 against the page and the cards, in light and dark mode', () => {
    const css = readFileSync('public/app.css', 'utf8');
    const start = css.indexOf('@media');
    const light = css.slice(0, start);
    const dark = css.slice(start, css.indexOf('}', start) + 1);
    const token = (block, name) => block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
    for (const block of [light, dark]) {
      const focus = token(block, 'focus') ?? token(light, 'focus');
      for (const background of [token(block, 'bg'), token(block, 'surface')]) {
        expect(contrast(focus, background), `${focus} on ${background}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});