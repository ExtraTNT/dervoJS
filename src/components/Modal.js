import { button, div, h2 } from '../elements.js';

/**
 * Modal component — a full-screen-overlay dialog.
 *
 * Renders nothing (returns an empty div) when `open` is false, so it
 * can be included unconditionally in the vnode tree.
 *
 * @param {Object}   opts
 * @param {boolean}  [opts.open=false]     - Controls visibility.
 * @param {string}   [opts.title]          - Modal heading.
 * @param {function} opts.onClose          - Called when the × button is clicked.
 * @param {vnode[]}  [opts.footer]         - Footer content, usually action buttons.
 * @returns {function} bodyChildren => vnode
 *
 * @example
 *   Modal({
 *     open: state.showModal,
 *     title: 'Confirm',
 *     onClose: () => setState({ showModal: false }),
 *     footer: [
 *       Button({ variant: 'secondary', onClick: () => setState({ showModal: false }) })(['Cancel']),
 *       Button({ variant: 'danger',    onClick: confirm })(['Delete']),
 *     ],
 *   })([p({})(['Are you sure?'])])
 */
const Modal = ({
  open = false,
  title,
  onClose,
  footer,
  className = '',
  style = '',
} = {}) => children =>
  open
    ? div({ className: 'modal-backdrop', onclick: e => { if (e.target === e.currentTarget) onClose?.(); } })([
        div({ className: ['modal', className].filter(Boolean).join(' '), style })([
          div({ className: 'modal-header' })([
            h2({ className: 'modal-title' })([title ?? '']),
            button({ className: 'modal-close', onclick: onClose, type: 'button' })(['×']),
          ]),
          div({ className: 'modal-body' })(children),
          ...(footer ? [div({ className: 'modal-footer' })(footer)] : []),
        ]),
      ])
    : div({ style: 'display:none' })([]);
    
export { Modal };
