/**
 * Visual pads — colour, navigation, VCR, numerics. Each is a pure function
 * of the most recent key so the active button stands out.
 */

import { div } from '../../src/index.js';

// shared building blocks

const pill = ({ label, active, bg = 'var(--surface)', fg = 'var(--text)' }) =>
  div({
    style: `border:1px solid var(--border); border-radius:8px; padding:4px 4px; text-align:center; font-weight:700; background:${bg}; color:${fg}; opacity:${active ? 1 : 0.45}; transform:scale(${active ? 1.05 : 1}); transition:opacity 200ms, transform 120ms`,
  })([label]);

const chip = (label, active) =>
  div({
    style: `padding:8px 10px; border:1px solid var(--border); border-radius:6px; font-family:ui-monospace,monospace; font-size:12px; background:${active ? 'var(--accent)' : 'transparent'}; color:${active ? '#fff' : 'var(--text)'}; text-align:center`,
  })([label]);

// colour buttons

const COLOURS = [
  { id: 'red',    label: 'RED',    bg: '#c0392b', fg: '#fff' },
  { id: 'green',  label: 'GREEN',  bg: '#27ae60', fg: '#fff' },
  { id: 'yellow', label: 'YELLOW', bg: '#f1c40f', fg: '#222' },
  { id: 'blue',   label: 'BLUE',   bg: '#2980b9', fg: '#fff' },
];

export const ColourPad = lastKey =>
  div({ style: 'display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:10px' })(
    COLOURS.map(c => pill({ label: c.label, active: lastKey === c.id, bg: c.bg, fg: c.fg }))
  );

// navigation D-pad

const NAV_GRID = [
  ['', 'up', ''],
  ['left', 'ok', 'right'],
  ['', 'down', ''],
];

export const NavPad = lastKey =>
  div({ style: 'display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:8px; max-width:240px; margin:0 auto' })(
    NAV_GRID.flat().map(k =>
      k === ''
        ? div({})([])
        : pill({
            label:  k.toUpperCase(),
            active: lastKey === k,
            bg:     lastKey === k ? 'var(--accent)' : 'var(--surface)',
            fg:     lastKey === k ? '#fff' : 'var(--text)',
          })
    )
  );

// VCR transport row

const VCR = ['rewind', 'play_pause', 'play', 'pause', 'stop', 'fast_fwd', 'back'];

export const VcrPad = lastKey =>
  div({ style: 'display:flex; flex-wrap:wrap; gap:6px' })(
    VCR.map(k => chip(k, lastKey === k))
  );

// numeric keypad

const NUMS = ['1','2','3','4','5','6','7','8','9','','0',''];

export const NumPad = lastKey =>
  div({ style: 'display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:4px; max-width:200px; margin:0 auto' })(
    NUMS.map(k => chip(k, lastKey === k))
  );
