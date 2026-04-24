import { div, input, p, span } from '../elements.js';

/**
 * Dropzone — drag-and-drop + click-to-browse file input.
 *
 * Curried: Dropzone(opts)(labelChildren)
 * Pass no children for the built-in "drop files here" label.
 *
 * State for drag-active must be managed by the parent and passed via `active`.
 *
 * @param {Object}   opts
 * @param {function} [opts.onDrop]          Receives FileList when files are dropped.
 * @param {function} [opts.onFileSelect]    Receives FileList when files are picked via dialog.
 * @param {function} [opts.onDragEnter]     Called when dragging enters the zone.
 * @param {function} [opts.onDragLeave]     Called when dragging leaves the zone.
 * @param {string}   [opts.accept='*']      MIME types / file extensions, e.g. 'image/*,.pdf'.
 * @param {boolean}  [opts.multiple=false]
 * @param {boolean}  [opts.disabled=false]
 * @param {boolean}  [opts.active=false]    Controlled drag-over highlight state.
 * @param {string}   [opts.inputId]         id on the hidden file input (for labels).
 * @param {string}   [opts.className='']
 * @param {string}   [opts.style='']
 * @returns {function} labelChildren => vnode
 *
 * @example
 *   Dropzone({
 *     accept: 'image/*',
 *     active: state.dzActive,
 *     onDragEnter: () => setState({ dzActive: true }),
 *     onDragLeave: () => setState({ dzActive: false }),
 *     onDrop:       files => setState({ dzActive: false, files: [...files] }),
 *     onFileSelect: files => setState({ files: [...files] }),
 *   })([])
 */
const Dropzone = ({
  onDrop,
  onFileSelect,
  onDragEnter,
  onDragLeave,
  accept = '*',
  multiple = false,
  disabled = false,
  active = false,
  inputId = 'dropzone-input',
  className = '',
  style = '',
} = {}) => children =>
  div({ className: ['dropzone', active && 'dropzone-active', disabled && 'dropzone-disabled', className].filter(Boolean).join(' '), style })([
    input({
      id: inputId,
      type: 'file',
      accept,
      multiple,
      disabled,
      className: 'dropzone-input',
      onchange: disabled ? undefined : e => onFileSelect?.(e.target.files),
    })([]),
    div({
      className: 'dropzone-hit',
      ondragover:  disabled ? undefined : e => { e.preventDefault(); onDragEnter?.(); },
      ondragleave: disabled ? undefined : () => onDragLeave?.(),
      ondrop:      disabled ? undefined : e => { e.preventDefault(); onDrop?.(e.dataTransfer.files); },
    })([
      ...(children && children.length
        ? children
        : [
            div({ className: 'dropzone-body' })([
              span({ className: 'dropzone-icon' })(['📁']),
              p({ className: 'dropzone-text' })(['Drop files here or click to browse']),
              p({ className: 'dropzone-hint' })([
                accept !== '*' ? `Accepted: ${accept}` : 'All file types accepted',
              ]),
            ]),
          ]
      ),
    ]),
  ]);

export { Dropzone };
