/**
 * Small adapters for the form widgets.
 *
 * The dervo TextInput / Select / Checkbox onChange handlers receive the raw
 * DOM Event (so callers can read `e.target.value` or `.checked`). The editor's
 * panels never use the event for anything else, so wrap them once with these.
 *
 *   TextInput({ value: x, onChange: onText(v => set({ x: v })) })
 *   Checkbox({ checked: y, onChange: onCheck(c => set({ y: c })) })
 */

const onText  = setter => e => setter(e?.target?.value ?? '');
const onCheck = setter => e => setter(!!e?.target?.checked);

export { onText, onCheck };
