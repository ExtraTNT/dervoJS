import { div, span, hr } from '../elements.js';

/**
 * Container — centered max-width wrapper.
 *
 * @param {Object}   opts
 * @param {'sm'|'md'|'lg'|'xl'|'full'|number} [opts.maxWidth='lg']
 *   Named breakpoint or explicit pixel number.
 * @param {boolean}  [opts.styled=false]  Adds surface background, border, shadow.
 * @param {string}   [opts.style='']      Extra inline styles.
 * @returns {function} children => vnode
 *
 * @example
 *   Container({ maxWidth: 'md', styled: true })([
 *     h1({})(['Hello']),
 *   ])
 */
const Container = ({ maxWidth = 'lg', styled = false, style = '' } = {}) => children => {
  const widthClass = typeof maxWidth === 'number' ? '' : `container-${maxWidth}`;
  const inlineStyle = typeof maxWidth === 'number'
    ? `max-width:${maxWidth}px; margin-inline:auto; padding-inline:16px; ${style}`
    : style;
  const cls = ['container', widthClass, styled ? 'container-styled' : '']
    .filter(Boolean).join(' ');
  return div({ className: cls, style: inlineStyle })(children);
};

/**
 * Row — 12-column CSS Grid container. Pair with Col for responsive layouts.
 *
 * @param {Object} opts
 * @param {number} [opts.gap=16]           Column+row gap in px.
 * @param {string} [opts.align='start']    CSS align-items value.
 * @param {string} [opts.style='']
 * @returns {function} children => vnode
 *
 * @example
 *   Row({ gap: 24 })([
 *     Col({ span: 12, md: 8 })([mainContent]),
 *     Col({ span: 12, md: 4 })([sidebar]),
 *   ])
 */
const Row = ({ gap = 16, align = 'start', style = '' } = {}) => children =>
  div({
    className: 'row',
    style: `--row-gap:${gap}px; --row-align:${align}; ${style}`,
  })(children);

/**
 * Col — responsive grid column. Must be a direct child of Row.
 *
 * @param {Object} opts
 * @param {number} [opts.span=12]  Default span (12 = full width).
 * @param {number} [opts.sm]       Span at 576px+.
 * @param {number} [opts.md]       Span at 768px+.
 * @param {number} [opts.lg]       Span at 1024px+.
 * @param {string} [opts.style='']
 * @returns {function} children => vnode
 *
 * @example
 *   // Three-col on desktop, single-col on mobile
 *   Col({ span: 12, md: 4 })([...])
 */
const Col = ({ span = 12, sm, md, lg, style = '' } = {}) => children => {
  const cls = [
    `col-${span}`,
    sm  ? `col-sm-${sm}`  : '',
    md  ? `col-md-${md}`  : '',
    lg  ? `col-lg-${lg}`  : '',
  ].filter(Boolean).join(' ');
  return div({ className: cls, style })(children);
};

/**
 * Stack — vertical flex column with uniform gaps.
 *
 * @param {Object} opts
 * @param {number} [opts.gap=16]
 * @param {string} [opts.align='stretch']  CSS align-items.
 * @param {string} [opts.style='']
 * @returns {function} children => vnode
 *
 * @example
 *   Stack({ gap: 8 })([
 *     Button({})(['First']),
 *     Button({})(['Second']),
 *   ])
 */
const Stack = ({ gap = 16, align = 'stretch', style = '' } = {}) => children =>
  div({
    className: 'stack',
    style: `--stack-gap:${gap}px; --stack-align:${align}; ${style}`,
  })(children);

/**
 * Grid — equal-column CSS grid. Children don't need Col wrappers.
 *
 * @param {Object}  opts
 * @param {number}  [opts.cols=3]      Columns at default width.
 * @param {number}  [opts.sm]          Columns at 576px+.
 * @param {number}  [opts.md]          Columns at 768px+.
 * @param {number}  [opts.lg]          Columns at 1024px+.
 * @param {number}  [opts.gap=16]      Gap in px.
 * @param {boolean} [opts.styled=false] Add surface background, shadow, padding.
 * @param {string}  [opts.style='']
 * @returns {function} children => vnode
 *
 * @example
 *   Grid({ cols: 1, md: 3, gap: 12 })(
 *     items.map(item => Card({})([ ... ]))
 *   )
 */
const Grid = ({ cols = 3, sm, md, lg, gap = 16, styled = false, style = '' } = {}) => children => {
  const cls = [
    'grid',
    `grid-cols-${cols}`,
    sm  ? `grid-sm-${sm}`  : '',
    md  ? `grid-md-${md}`  : '',
    lg  ? `grid-lg-${lg}`  : '',
    styled ? 'grid-styled' : '',
  ].filter(Boolean).join(' ');
  return div({ className: cls, style: `--grid-gap:${gap}px; ${style}` })(children);
};

/**
 * PageLayout — full-viewport app shell with sticky top/bottom bars,
 * toggle-able left/right panels, scrollable main area and optional footer.
 *
 * @param {Object}  opts
 * @param {*}       [opts.topBar]               Sticky top bar content.
 * @param {*}       [opts.sidebar]              Left sidebar content.
 * @param {boolean} [opts.sidebarOpen=true]     Show/hide sidebar (CSS transition).
 * @param {string}  [opts.sidebarWidth='240px']
 * @param {*}       [opts.rightBar]             Optional right panel content.
 * @param {boolean} [opts.rightBarOpen=true]    Show/hide right panel.
 * @param {string}  [opts.rightBarWidth='260px']
 * @param {*}       [opts.footer]               Non-sticky footer at bottom of scroll area.
 * @param {*}       [opts.bottomBar]            Sticky bottom bar.
 * @param {string}  [opts.mainPadding='24px']   Main content area padding.
 * @param {string}  [opts.style='']
 * @returns {function} children => vnode
 *
 * @example
 *   PageLayout({
 *     topBar:      TopBar(state),
 *     sidebar:     SideNav(state),
 *     sidebarOpen: state.navOpen,
 *     footer:      Footer(),
 *   })([ActivePanel(state)])
 */
const PageLayout = ({
  topBar        = null,
  sidebar       = null,
  sidebarOpen   = true,
  sidebarWidth  = '240px',
  rightBar      = null,
  rightBarOpen  = true,
  rightBarWidth = '260px',
  footer        = null,
  bottomBar     = null,
  mainPadding   = '24px',
  style         = '',
} = {}) => children =>
  div({ className: 'page-layout', style })([
    ...(topBar    ? [div({ className: 'page-layout-top' })([topBar])]        : []),
    div({ className: 'page-layout-body' })([
      ...(sidebar  ? [div({
        className : `page-layout-sidebar${sidebarOpen  ? '' : ' page-sidebar-closed'}`,
        style     : `--sidebar-width:${sidebarWidth}`,
      })([sidebar])] : []),
      div({ className: 'page-layout-main', style: `--main-padding:${mainPadding}` })(children),
      ...(rightBar ? [div({
        className : `page-layout-right${rightBarOpen ? '' : ' page-rightbar-closed'}`,
        style     : `--right-width:${rightBarWidth}`,
      })([rightBar])] : []),
    ]),
    ...(footer    ? [div({ className: 'page-layout-footer' })([footer])]    : []),
    ...(bottomBar ? [div({ className: 'page-layout-bottom' })([bottomBar])] : []),
  ]);

/**
 * AppShell — topBar + collapsible sidebar + main + optional footer.
 * Preset for dashboards and SPAs. Thin wrapper around PageLayout.
 *
 * @param {Object}  opts
 * @param {*}       opts.topBar
 * @param {*}       [opts.sidebar]
 * @param {boolean} [opts.sidebarOpen=true]
 * @param {string}  [opts.sidebarWidth='220px']
 * @param {*}       [opts.footer]
 * @returns {function} mainChildren => vnode
 *
 * @example
 *   AppShell({ topBar: TopBar(s), sidebar: Nav(s), sidebarOpen: s.navOpen })([
 *     ActivePanel(s),
 *   ])
 */
const AppShell = ({ topBar, sidebar, sidebarOpen = true, sidebarWidth = '220px', footer } = {}) =>
  children => PageLayout({ topBar, sidebar, sidebarOpen, sidebarWidth, footer })(children);

/**
 * TwoPane — side-by-side split view without a top bar.
 * Good for editors, diff views, or comparison layouts.
 * The left pane collapses via the `leftOpen` prop.
 *
 * @param {Object}  opts
 * @param {*}       opts.left             Left pane content.
 * @param {boolean} [opts.leftOpen=true]  Show/hide left pane.
 * @param {string}  [opts.leftWidth='360px']
 * @param {string}  [opts.style='']
 * @returns {function} rightChildren => vnode
 *
 * @example
 *   TwoPane({ left: FileTree(s), leftOpen: s.treeOpen })([Editor(s)])
 */
const TwoPane = ({ left, leftOpen = true, leftWidth = '360px', style = '' } = {}) =>
  rightChildren =>
    PageLayout({
      sidebar: left, sidebarOpen: leftOpen, sidebarWidth: leftWidth,
      mainPadding: '0', style,
    })(rightChildren);

/**
 * BlogLayout — centered content column with optional full-width header and footer.
 * No sidebar. Suitable for articles, documentation, and content-focused pages.
 *
 * @param {Object}  opts
 * @param {*}       [opts.header]           Full-width header (rendered as topBar).
 * @param {*}       [opts.footer]           Non-sticky footer at bottom of scroll area.
 * @param {string}  [opts.maxWidth='680px'] Content column max-width.
 * @param {string}  [opts.mainPadding='32px 16px']
 * @returns {function} children => vnode
 *
 * @example
 *   BlogLayout({ header: SiteHeader(), footer: SiteFooter(), maxWidth: '720px' })([
 *     article,
 *   ])
 */
const BlogLayout = ({ header, footer, maxWidth = '680px', mainPadding = '32px 16px' } = {}) =>
  children =>
    PageLayout({ topBar: header || null, footer, mainPadding })([
      div({ style: `max-width:${maxWidth}; margin-inline:auto; width:100%` })(children),
    ]);

/**
 * Divider — horizontal separator with an optional centered text label.
 *
 * @param {Object}  opts
 * @param {string}  [opts.label]    Text label in the center of the line.
 * @param {string}  [opts.style='']
 * @returns {vnode}
 *
 * @example
 *   Divider()
 *   Divider({ label: 'or' })
 */
const Divider = ({ label: labelText, style = '' } = {}) =>
  labelText
    ? div({ className: 'divider', style })([
        div({ className: 'divider-line' })([]),
        span({ className: 'divider-label' })([labelText]),
        div({ className: 'divider-line' })([]),
      ])
    : hr({ className: 'divider-plain', style })([]);

/**
 * Spacer — a flex-grow filler that pushes siblings apart.
 *
 * @param {Object}        opts
 * @param {number|string} [opts.size]  Fixed size (number = px, string = any CSS value).
 * @param {string}        [opts.style='']
 * @returns {vnode}
 *
 * @example
 *   flexRow({})([LeftContent, Spacer(), RightContent])
 */
const Spacer = ({ size, style = '' } = {}) => {
  const sz = size ? (typeof size === 'number' ? `${size}px` : size) : undefined;
  return div({
    className: 'spacer',
    style: [sz && `width:${sz}; height:${sz}; flex:none`, !sz && 'flex:1', style].filter(Boolean).join('; '),
  })([]);
};

/**
 * AspectBox — constrains children to a fixed aspect ratio.
 *
 * @param {Object}  opts
 * @param {string}  [opts.ratio='16/9']  CSS aspect-ratio value.
 * @param {string}  [opts.style='']
 * @returns {function} children => vnode
 *
 * @example
 *   AspectBox({ ratio: '4/3' })([VideoPlayer])
 */
const AspectBox = ({ ratio = '16/9', style = '' } = {}) => children =>
  div({ className: 'aspect-box', style: `aspect-ratio:${ratio}; ${style}` })(children);

/**
 * Float — applies CSS float to its children with a clearfix wrapper.
 *
 * @param {Object}          opts
 * @param {'left'|'right'}  [opts.side='left']  Float direction.
 * @param {string}          [opts.style='']     Extra inline styles on the float element.
 * @returns {function} children => vnode  (wrapped in clearfix)
 *
 * @example
 *   Float({ side: 'left' })([Img({ src: '/thumb.jpg', width: 120 })])
 */
const Float = ({ side = 'left', style = '' } = {}) => children =>
  div({ className: `float-${side}`, style })(children);

/**
 * Clearfix — wrapper that clears floated children.
 *
 * @param {string}  [opts.style='']
 * @returns {function} children => vnode
 *
 * @example
 *   Clearfix()([Float({ side: 'left' })([Img(...)]), p({})(['Body text wraps the float.'])])
 */
const Clearfix = ({ style = '' } = {}) => children =>
  div({ className: 'clearfix', style })(children);

// ── DragList ──────────────────────────────────────────────────────────────

/**
 * DragList — drag-and-drop reorderable list with optional cross-list transfer.
 *
 * Fully stateless: the component renders from an `items` array you own in your
 * store and calls `onChange(newItems)` whenever the order changes or an item is
 * moved in from another list.
 *
 * Cross-list drag is enabled by giving two or more DragLists the same `groupId`.
 * Items are moved (not copied) between lists; both lists' `onChange` fire.
 *
 * Each entry in `items` must have a unique `id` field.  Any other fields are
 * passed through to `renderItem` as the first argument.
 *
 * @param {Object}    opts
 * @param {Array}     opts.items              - Array of objects (must each have `id`).
 * @param {function}  opts.onChange           - (newItems: Array) => void — called after drop.
 * @param {function}  opts.renderItem         - (item, isDragging: bool) => vnode
 * @param {string}    [opts.groupId]          - Shared token that allows cross-list drops.
 * @param {function}  [opts.onAdd]            - (item) => void — fires on the *receiving* list when
 *                                              an item arrives from another group member. If omitted
 *                                              the item is prepended and onChange fires instead.
 * @param {function}  [opts.onRemove]         - (item) => void — fires on the *source* list when an
 *                                              item leaves. If omitted the item is removed and
 *                                              onChange fires instead.
 * @param {boolean}   [opts.disabled=false]   - Disable all drag interactions.
 * @param {'vertical'|'horizontal'} [opts.direction='vertical']
 * @param {string}    [opts.emptyLabel='Drop items here']
 * @param {string}    [opts.className='']
 * @param {string}    [opts.style='']
 * @returns {vnode}
 *
 * @example
 *   // Single list reorder
 *   DragList({
 *     items: state.tasks,
 *     onChange: tasks => setState({ tasks }),
 *     renderItem: item => span({})([item.label]),
 *   })
 *
 *   // Two-list "keep / delete" pattern
 *   const moved = (from, to) => item => {
 *     setState({
 *       [from]: state[from].filter(x => x.id !== item.id),
 *       [to]:   [...state[to], item],
 *     });
 *   };
 *   DragList({ groupId: 'review', items: state.keep,   onChange: keep   => setState({ keep }),   onAdd: moved('del','keep'),   onRemove: moved('keep','del'),   renderItem: i => span({})([i.label]) })
 *   DragList({ groupId: 'review', items: state.del,    onChange: del    => setState({ del }),    onAdd: moved('keep','del'),   onRemove: moved('del','keep'),   renderItem: i => span({})([i.label]) })
 */
const DragList = ({
  items        = [],
  onChange,
  renderItem,
  groupId      = '',
  listId       = '',
  onTransfer,
  disabled     = false,
  direction    = 'vertical',
  emptyLabel   = 'Drop items here',
  className    = '',
  style        = '',
} = {}) => {
  const DRAG_ID_KEY   = 'text/x-draglist-id';
  const DRAG_GRP_KEY  = 'text/x-draglist-group';
  const DRAG_LIST_KEY = 'text/x-draglist-listid';

  const reorder = arr => fromId => toId => {
    const from = arr.findIndex(x => String(x.id) === fromId);
    const to   = arr.findIndex(x => String(x.id) === toId);
    if (from === -1 || to === -1 || from === to) return arr;
    const next = [...arr];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  };

  const itemNodes = items.map(item =>
    div({
      className:   `drag-item${disabled ? ' drag-item-disabled' : ''}`,
      draggable:   !disabled,
      'data-id':   item.id,
      key:         String(item.id),

      // ── drag source events ──────────────────────────────────────────
      ondragstart: disabled ? null : e => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData(DRAG_ID_KEY,   String(item.id));
        e.dataTransfer.setData(DRAG_GRP_KEY,  groupId);
        e.dataTransfer.setData(DRAG_LIST_KEY, listId);
        e.currentTarget.classList.add('drag-item-dragging');
      },
      ondragend: disabled ? null : e => {
        e.currentTarget.classList.remove('drag-item-dragging');
      },

      // ── drop target events (item-level) ────────────────────────────
      ondragover: disabled ? null : e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.classList.add('drag-item-over');
      },
      ondragleave: disabled ? null : e => {
        e.currentTarget.classList.remove('drag-item-over');
      },
      ondrop: disabled ? null : e => {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-item-over');
        const srcId     = e.dataTransfer.getData(DRAG_ID_KEY);
        const srcGrp    = e.dataTransfer.getData(DRAG_GRP_KEY);
        const srcListId = e.dataTransfer.getData(DRAG_LIST_KEY);

        if (srcGrp !== groupId) return;           // unrelated list
        if (srcListId === listId) {
          // same list: reorder
          const next = reorder(items)(srcId)(String(item.id));
          if (next !== items) onChange?.(next);
          e.stopPropagation();                    // handled — don't let container fire too
        }
        // cross-list: fall through so the event reaches the container ondrop
      },
    })([renderItem(item)])
  );

  // Container handles cross-list transfers and drops onto empty space
  const containerDrop = disabled ? null : e => {
    e.preventDefault();
    const srcId     = e.dataTransfer.getData(DRAG_ID_KEY);
    const srcGrp    = e.dataTransfer.getData(DRAG_GRP_KEY);
    const srcListId = e.dataTransfer.getData(DRAG_LIST_KEY);

    if (srcGrp !== groupId) return;              // different group — ignore
    if (srcListId === listId) return;            // same list drop on empty space — ignore
    if (items.some(x => String(x.id) === srcId)) return;  // already here

    // Notify the caller directly — no DOM event needed
    onTransfer?.(srcId)(srcListId)(listId);
  };

  const cls = [
    'drag-list',
    `drag-list-${direction}`,
    disabled && 'drag-list-disabled',
    className,
  ].filter(Boolean).join(' ');

  return div({
    className: cls,
    style,
    'data-draglist-group': groupId,
    'data-draglist-list':  listId,
    ondragover:  disabled ? null : e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; },
    ondrop:      containerDrop,
  })([
    ...itemNodes,
    ...(items.length === 0
      ? [div({ className: 'drag-list-empty' })([emptyLabel])]
      : []),
  ]);
};

/**
 * useDragListGroup — returns an onTransfer callback that moves items between
 * named store slices. Pass the same returned function as the `onTransfer` prop
 * to every DragList in the group.
 *
 * @param {Object}  slices  Keys = listId strings. Values = { getItems, setItems }.
 * @returns {function} (srcId, srcListId, targetListId) => void
 *
 * @example
 *   const onTransfer = useDragListGroup({
 *     keep: { getItems: () => getState().keep, setItems: keep => setState({ keep }) },
 *     del:  { getItems: () => getState().del,  setItems: del  => setState({ del  }) },
 *   });
 *   DragList({ groupId:'review', listId:'keep', onTransfer, ... })
 *   DragList({ groupId:'review', listId:'del',  onTransfer, ... })
 */
const useDragListGroup = slices => srcId => srcListId => targetListId => {
  const src    = slices[srcListId];
  const target = slices[targetListId];
  if (!src || !target) return;

  const item = src.getItems().find(x => String(x.id) === srcId);
  if (!item) return;
  src.setItems(src.getItems().filter(x => String(x.id) !== srcId));
  target.setItems([...target.getItems(), item]);
};

export { Container, Row, Col, Stack, Grid, PageLayout, AppShell, TwoPane, BlogLayout, Divider, Spacer, AspectBox, Float, Clearfix, DragList, useDragListGroup };
