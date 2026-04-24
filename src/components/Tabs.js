import { button, div } from '../elements.js';

/**
 * Tabs component — a tab strip paired with tab panel content.
 *
 * @param {Object}   opts
 * @param {Array}    opts.tabs              - Array of { id, label } tab descriptors.
 * @param {string}   opts.activeTab         - id of the currently active tab.
 * @param {function} opts.onTabChange       - Called with the tab id when a tab is clicked.
 * @returns {function} panelChildren => vnode
 *   panelChildren should be an array whose element at index i corresponds to tabs[i].
 *   Only the panel matching activeTab is rendered.
 *
 * @example
 *   Tabs({
 *     tabs: [{ id: 'a', label: 'Tab A' }, { id: 'b', label: 'Tab B' }],
 *     activeTab: state.tab,
 *     onTabChange: id => setState({ tab: id }),
 *   })([
 *     div({})(['Content A']),
 *     div({})(['Content B']),
 *   ])
 */
const Tabs = ({ tabs = [], activeTab, onTabChange, className = '', style = '' } = {}) => panels => {
  const activeIndex = tabs.findIndex(t => t.id === activeTab);
  const activePanel = panels[activeIndex] ?? div({})([]);
  return div({ className: ['tabs-wrapper', className].filter(Boolean).join(' '), style })([
    div({ className: 'tabs-list' })(
      tabs.map(t =>
        button({
          className: ['tab-btn', t.id === activeTab && 'active'].filter(Boolean).join(' '),
          onclick: () => onTabChange(t.id),
          type: 'button',
        })([t.label])
      )
    ),
    div({ className: 'tab-panel' })([activePanel]),
  ]);
};

export { Tabs };
