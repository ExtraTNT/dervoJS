import {
  div, span, strong, p,
  Card, Row, Col, Stack,
  Badge,
  NumberInput,
  ColorPicker,
  DateTimePicker,
} from '../../src/index.js';
import { setState } from '../store.js';

/* ── Result display helper ─────────────────────────────────────────────── */
const Val = (v, muted = false) =>
  span({
    style: `font-family:var(--font-mono,monospace); font-size:.85rem; color:${muted ? 'var(--text-muted)' : 'var(--accent)'}`,
  })([String(v)]);

/* ── Panel ─────────────────────────────────────────────────────────────── */
export const pickersPanel = state =>
  div({})([

    // ── NumberInput ─────────────────────────────────────────────────────────
    Card({ title: 'NumberInput' })([
      Row({ gap: 24 })([
        Col({ span: 12 })([
          Stack({ gap: 16 })([
            div({})([
              NumberInput({
                label: 'Quantity (0–99)',
                value: state.pickerNumber,
                min: 0, max: 99, step: 1,
                onChange: v => setState({ pickerNumber: v }),
              }),
              p({ style: 'margin-top:6px; font-size:.85rem; color:var(--text-muted)' })(['Value: ', Val(state.pickerNumber)]),
            ]),
            div({})([
              NumberInput({
                label: 'Step 5',
                value: state.pickerNumber,
                min: 0, max: 100, step: 5,
                onChange: v => setState({ pickerNumber: v }),
              }),
            ]),
            div({})([
              NumberInput({
                label: 'Disabled',
                value: 42,
                disabled: true,
              }),
            ]),
          ]),
        ]),
      ]),
    ]),

    // ── ColorPicker ─────────────────────────────────────────────────────────
    div({ style: 'margin-top: 16px' })([
      Card({ title: 'ColorPicker' })([
        Row({ gap: 32 })([
          Col({ span: 12 })([
            Stack({ gap: 12 })([
              div({})([
                ColorPicker({
                  label: 'Brand colour',
                  value: state.pickerColor,
                  onChange: v => setState({ pickerColor: v }),
                }),
                p({ style: 'margin-top:6px; font-size:.85rem; color:var(--text-muted)' })(
                  ['Value: ', Val(state.pickerColor)]
                ),
              ]),
              div({})([
                p({ style: 'font-size:.85rem; color:var(--text-muted); margin-bottom:4px' })(['Live preview:']),
                div({ style: `width:100%; height:40px; border-radius:var(--radius); background:${state.pickerColor}; border:1px solid var(--border)` })([]),
              ]),
            ]),
          ]),
        ]),
      ]),
    ]),

    // ── DateTimePicker ──────────────────────────────────────────────────────
    div({ style: 'margin-top: 16px' })([
      Card({ title: 'DateTimePicker' })([
        Row({ gap: 32 })([
          // Date-only
          Col({ span: 12 })([
            div({})([
              p({ style: 'font-size:.8rem; color:var(--text-muted); margin-bottom:6px' })([strong({})(['Date only'])]),
              DateTimePicker({
                label: 'Pick a date',
                value: state.pickerDate,
                viewYear: state.pickerDpYear,
                viewMonth: state.pickerDpMonth,
                onChange: v => setState({ pickerDate: v }),
                onViewChange: ({ year, month }) => setState({ pickerDpYear: year, pickerDpMonth: month }),
              }),
              p({ style: 'margin-top:8px; font-size:.85rem; color:var(--text-muted)' })(['Selected: ', Val(state.pickerDate || 'none', !state.pickerDate)]),
            ]),
          ]),
          // Date + Time
          Col({ span: 12 })([
            div({})([
              p({ style: 'font-size:.8rem; color:var(--text-muted); margin-bottom:6px' })([strong({})(['Date + Time'])]),
              DateTimePicker({
                label: 'Pick a date and time',
                value: state.pickerDateTime,
                viewYear: state.pickerDtYear,
                viewMonth: state.pickerDtMonth,
                showTime: true,
                onChange: v => setState({ pickerDateTime: v }),
                onViewChange: ({ year, month }) => setState({ pickerDtYear: year, pickerDtMonth: month }),
              }),
              p({ style: 'margin-top:8px; font-size:.85rem; color:var(--text-muted)' })(['Selected: ', Val(state.pickerDateTime || 'none', !state.pickerDateTime)]),
            ]),
          ]),
        ]),
      ]),
    ]),

  ]);
