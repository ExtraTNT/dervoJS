/**
 * ConfirmDialog — reusable centered confirmation modal driven by the editor
 * store. Replaces window.confirm() in the editor with something themable.
 *
 * Usage:
 *   import { confirmAction } from './components/ConfirmDialog.js';
 *
 *   confirmAction({
 *     title:        'Delete room',
 *     message:      'Delete room "Inn"? Choices linking here will be cleared.',
 *     confirmLabel: 'Delete',
 *     danger:       true,
 *     onConfirm:    () => _deleteRoom(id),
 *   });
 *
 * The dialog renders centered with a backdrop. Backdrop click cancels;
 * Escape cancels via window-level keydown (wired below in `ConfirmDialog`
 * the first time it mounts). Confirm fires `onConfirm` then closes.
 *
 * Multiple stacked confirms aren't supported — the second call replaces the
 * first. That matches plain confirm() semantics closely enough.
 */

import { div, h2, p, button } from '../../src/elements.js';
import { Button } from '../../src/components/Button.js';
import { setState, getState } from '../store.js';

// ── store wiring ─────────────────────────────────────────────────────────────

const _cancel = () => setState({
  confirmDialog: { open: false, title: '', message: '', confirmLabel: 'Confirm', cancelLabel: 'Cancel', danger: false, onConfirm: null },
});

const _confirm = () => {
  const cb = getState().confirmDialog?.onConfirm;
  _cancel();                  // close first so onConfirm side-effects render against a closed dialog
  if (typeof cb === 'function') {
    try { cb(); } catch (e) { console.error('[ConfirmDialog] onConfirm threw', e); }
  }
};

// Public helper — call site doesn't need to touch setState directly.
const confirmAction = ({
  title        = 'Are you sure?',
  message      = '',
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  danger       = false,
  onConfirm    = () => {},
} = {}) => setState({
  confirmDialog: { open: true, title, message, confirmLabel, cancelLabel, danger, onConfirm },
});

// ── Escape-to-cancel — wired once per page load ──────────────────────────────

let _keyboardWired = false;
const _wireKeyboard = () => {
  if (_keyboardWired || typeof window === 'undefined') return;
  _keyboardWired = true;
  window.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const s = getState();
    if (s.confirmDialog?.open) { e.preventDefault(); _cancel(); }
  });
};

// ── view ─────────────────────────────────────────────────────────────────────

const ConfirmDialog = state => {
  _wireKeyboard();
  const cd = state.confirmDialog || { open: false };
  if (!cd.open) return [];

  // Backdrop catches clicks outside the modal. stopPropagation on the modal
  // itself so clicking inside doesn't bubble to the backdrop.
  return [div({
    className: 'gef-confirm-backdrop',
    onclick:   _cancel,
    style:     'position:fixed; inset:0; background:rgba(0,0,0,0.45); z-index:9999; display:grid; place-items:center; padding:24px',
  })([
    div({
      className: 'gef-confirm-modal',
      onclick:   e => e.stopPropagation(),
      role:      'dialog',
      'aria-modal': 'true',
      style:     'max-width:440px; width:100%; background:var(--surface); color:var(--text); border:1px solid var(--border); border-radius:var(--radius); box-shadow:0 12px 40px rgba(0,0,0,0.35); padding:20px 22px; display:flex; flex-direction:column; gap:12px',
    })([
      h2({ style: 'margin:0; font-size:16px; font-weight:600' })([cd.title || 'Are you sure?']),
      ...(cd.message
        ? [p({ style: 'margin:0; font-size:13px; color:var(--text-muted); line-height:1.5; white-space:pre-wrap' })([cd.message])]
        : []),
      div({ style: 'display:flex; justify-content:flex-end; gap:8px; margin-top:8px' })([
        Button({ variant: 'ghost',   size: 'sm', onClick: _cancel  })([cd.cancelLabel  || 'Cancel']),
        Button({ variant: cd.danger ? 'danger' : 'primary', size: 'sm', onClick: _confirm })([cd.confirmLabel || 'Confirm']),
      ]),
    ]),
  ])];
};

export { ConfirmDialog, confirmAction };
