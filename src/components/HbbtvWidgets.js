/**
 * dervoJS - HbbTV / TV-remote widgets.
 *
 * *Unstyled*. Each component only contributes the markup the focus
 * manager needs (`data-focus` etc.) plus the minimum structural CSS the
 * widget needs to function (flex/grid direction, overflow when scrollable).
 * No padding, no borders, no background-colors, no focus halo by default.
 *
 * Visual treatment is the app's job - hook into the classnames each widget
 * stamps, or pass `style` / `activeStyle` as needed.
 *
 *   Class                  Applied to
 *   
 *   .focusable             every Focusable root
 *   .focusable-active      ↑ when state.focus.id matches
 *   .focusable-scroll      ↑ when scroll is set (any axis)
 *   .focus-list            FocusList container
 *   .focus-list-item       each row inside FocusList
 *   .focus-grid            FocusGrid container
 *   .focus-grid-cell       each cell inside FocusGrid
 *   .tab-bar               TabBar container
 *   .tab                   each tab
 *   .tab-active            ↑ when tab.id === current
 *
 * The library still owns the **functional** markup contract used by
 * createFocusManager:
 *   <div id="focus-<id>" data-focus="<id>" [data-focus-scroll="x|y|xy"]>
 */

import { div } from '../elements.js';

// Focusable 

/**
 * @param {Object}  opts
 * @param {string}  opts.id
 * @param {Object}  opts.focus              state.focus
 * @param {'x'|'y'|'xy'} [opts.scroll]      scrollable axis
 * @param {string}  [opts.row]              row strip this focusable belongs to -
 *                                          LEFT/RIGHT navigation is confined to
 *                                          focusables in the same row (UP/DOWN
 *                                          still cross rows freely). Pass on
 *                                          nav strips (top tabs, sub-tabs, …)
 *                                          to prevent sideways drift between
 *                                          stacked navigation levels.
 * @param {string}  [opts.maxHeight]        only meaningful with scroll='y' / 'xy'
 * @param {string}  [opts.maxWidth]         only meaningful with scroll='x' / 'xy'
 * @param {string}  [opts.style='']         arbitrary inline style
 * @param {string}  [opts.activeStyle='']   inline style appended when focused
 * @param {string}  [opts.className='']     extra classnames
 */
const Focusable = ({
  id, focus, scroll, row,
  style = '', className = '', maxHeight, maxWidth, activeStyle = '',
} = {}) => children => {
  const isFocused = focus?.id === id;

  // Only the structural bits - no decoration.
  const scrollStyle = scroll
    ? (scroll.includes('y') ? 'overflow-y:auto;' : '')
    + (scroll.includes('x') ? 'overflow-x:auto;' : '')
    + (maxHeight ? `max-height:${maxHeight};` : '')
    + (maxWidth  ? `max-width:${maxWidth};`   : '')
    : '';

  const classes = [
    'focusable',
    scroll && 'focusable-scroll',
    isFocused && 'focusable-active',
    className,
  ].filter(Boolean).join(' ');

  const props = {
    id:           `focus-${id}`,
    'data-focus': id,
    className:    classes,
    style:        `${style}${scrollStyle ? ';' + scrollStyle : ''}${isFocused && activeStyle ? ';' + activeStyle : ''}`,
  };
  if (scroll) props['data-focus-scroll'] = scroll;
  if (row)    props['data-focus-row']    = row;

  return div(props)(children);
};

// FocusList 

/**
 * Vertical (or horizontal) list of focusables.
 *
 * @param {Object}    opts
 * @param {Array}     opts.items                 [{ id, label, ... }]
 * @param {Object}    opts.focus
 * @param {function}  [opts.render]              (item, focused) => vnode
 * @param {'vertical'|'horizontal'} [opts.direction='vertical']
 * @param {string}    [opts.gap='0']
 * @param {string}    [opts.itemClassName]       extra class on each row
 * @param {string}    [opts.itemStyle]           extra inline style on each row
 */
const FocusList = ({
  items = [], focus, render, direction = 'vertical', gap = '0', row,
  itemClassName = '', itemStyle = '',
} = {}) =>
  div({
    className: 'focus-list',
    style: `display:flex;${direction === 'horizontal' ? 'flex-direction:row;flex-wrap:wrap;' : 'flex-direction:column;'}gap:${gap}`,
  })(items.map(it => Focusable({
    id:        it.id,
    focus,
    row,
    className: ['focus-list-item', itemClassName].filter(Boolean).join(' '),
    style:     itemStyle,
  })([
    render ? render(it, focus?.id === it.id) : it.label,
  ])));

// FocusGrid 

/**
 * CSS grid of focusable cells.
 *
 * @param {Object}    opts
 * @param {Array}     opts.items
 * @param {number}    opts.cols
 * @param {Object}    opts.focus
 * @param {function}  [opts.render]            (item, focused) => vnode
 * @param {string}    [opts.gap='0']
 * @param {string}    [opts.cellClassName]
 * @param {string}    [opts.cellStyle]
 */
const FocusGrid = ({
  items = [], cols = 3, focus, render, gap = '0', row,
  cellClassName = '', cellStyle = '',
} = {}) =>
  div({
    className: 'focus-grid',
    style: `display:grid;grid-template-columns:repeat(${cols}, minmax(0, 1fr));gap:${gap}`,
  })(items.map(it => Focusable({
    id:        it.id,
    focus,
    row,
    className: ['focus-grid-cell', cellClassName].filter(Boolean).join(' '),
    style:     cellStyle,
  })([
    render ? render(it, focus?.id === it.id) : it.label,
  ])));

// FocusScroll 

/**
 * Single scrollable focusable. The library only wires the scroll
 * behaviour + focus markup; visual chrome is the caller's job.
 *
 * @param {Object} opts
 * @param {string} opts.id
 * @param {Object} opts.focus
 * @param {'x'|'y'|'xy'} [opts.axis='y']
 * @param {string} [opts.maxHeight]
 * @param {string} [opts.maxWidth]
 * @param {string} [opts.style='']
 * @param {string} [opts.className='']
 * @param {string} [opts.activeStyle='']
 */
const FocusScroll = ({
  id, focus, axis = 'y', maxHeight, maxWidth, row,
  style = '', className = '', activeStyle = '',
} = {}) => children =>
  Focusable({
    id, focus, row,
    scroll: axis,
    maxHeight, maxWidth,
    style, activeStyle,
    className,
  })(children);

// TabBar

/**
 * Horizontal strip of focusable tabs. No styling - hook .tab / .tab-active
 * (or pass `tabClassName` / `tabStyle`) to dress them.
 *
 * @param {Object} opts
 * @param {Array}  opts.tabs                  [{ id, label }]
 * @param {string} opts.current               id of the currently active tab
 * @param {Object} opts.focus
 * @param {string} [opts.idPrefix='tab-']
 * @param {string} [opts.gap='0']
 * @param {string} [opts.tabClassName]        extra class on every tab
 * @param {string} [opts.tabStyle]            extra inline style on every tab
 */
const TabBar = ({
  tabs = [], current, focus, idPrefix = 'tab-', gap = '0', row,
  tabClassName = '', tabStyle = '',
} = {}) =>
  div({ className: 'tab-bar', style: `display:flex;gap:${gap}` })(
    tabs.map(t => {
      const isActive = t.id === current;
      const classes  = ['tab', isActive && 'tab-active', tabClassName].filter(Boolean).join(' ');
      return Focusable({
        id:        `${idPrefix}${t.id}`,
        focus,
        row,
        className: classes,
        style:     tabStyle,
      })([t.label]);
    })
  );

export { Focusable, FocusList, FocusGrid, FocusScroll, TabBar };
