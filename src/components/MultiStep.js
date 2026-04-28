/**
 * MultiStep — curried vnode multistep component.
 *
 * Usage:
 *   MultiStep({ steps, idx, setIdx, values, setValues, onDone })([])
 *
 * Integrates with the library renderer and expects parent/store to own
 * the `idx` and `values` state so the component remains a pure vnode.
 */

import { div, button } from '../elements.js';
import { Card } from './Card.js';
import { getBus } from '../listeners.js';
import { validateForm, isFormValid } from '../validate.js';


const MultiStep = ({
	steps = [],
	idx = 0,
	setIdx = () => {},
	values = {},
	setValues = () => {},
	onDone = () => {},
	onInvalid = null,
	busId = null,
	showValidation = false,
	validationMsg = null,
	className = '',
	style = '',
} = {}) =>
	() => {
		const i = Math.max(0, Math.min(idx || 0, Math.max(0, steps.length - 1)));
		const step = steps[i] || {};
		const bus = busId ? getBus(busId) : null;

		const setValue = (k, v) => {
			const newValues = { ...(values || {}), [k]: v };
			if (typeof setValues === 'function') {
				try { setValues(prev => ({ ...(prev || {}), [k]: v })); }
				catch (e) { try { setValues(newValues); } catch (_) {} }
			}
			// notify bus subscribers of the value change
			if (bus) try { bus.emit('change', { id: busId, idx: i, values: newValues }); } catch (_) {}
		};

		const checkValidation = () => {
			if (!step || !step.validate) return { ok: true, msg: null, errors: null };

			// Schema-style validation object -> use validateForm
			if (typeof step.validate === 'object' && !Array.isArray(step.validate)) {
				try {
					const errors = validateForm(step.validate)(values || {});
					const ok = isFormValid(errors);
					const firstError = Object.values(errors).find(v => v !== null) || null;
					return { ok, msg: firstError, errors };
				} catch (e) { return { ok: false, msg: 'Invalid', errors: null }; }
			}

			// Function-style validator: may return boolean, string (error), null, or errors object
			if (typeof step.validate === 'function') {
				try {
					const res = step.validate(values || {});
					if (typeof res === 'string') return { ok: false, msg: res, errors: null };
					if (res === null || res === true) return { ok: true, msg: null, errors: null };
					if (res === false) return { ok: false, msg: 'Invalid', errors: null };
					if (typeof res === 'object') {
						const ok = isFormValid(res);
						const firstError = Object.values(res).find(v => v !== null) || null;
						return { ok, msg: firstError, errors: res };
					}
					return { ok: true, msg: null, errors: null };
				} catch (e) { return { ok: false, msg: 'Invalid', errors: null }; }
			}

			return { ok: true, msg: null, errors: null };
		};

		const next = () => {
			const v = checkValidation();
			if (!v.ok) {
				if (bus) try { bus.emit('invalid', { id: busId, idx: i, msg: v.msg, errors: v.errors }); } catch (_) {}
				if (typeof onInvalid === 'function') try { onInvalid(v); } catch (_) {}
				return;
			}

			if (i >= steps.length - 1) {
				try { onDone({ values: values || {} }); } catch (_) {}
				if (bus) try { bus.emit('done', { id: busId, values: values || {} }); } catch (_) {}
				return;
			}

			setIdx(i + 1);
			if (bus) try { bus.emit('step', { id: busId, idx: i + 1, values: values || {} }); } catch (_) {}
		};

		const prev = () => { if (i > 0) setIdx(i - 1); };

		const goTo = j => {
			if (typeof j !== 'number' || j < 0 || j >= steps.length) return;
			const v = checkValidation();
			if (j > i && !v.ok) {
				if (bus) try { bus.emit('invalid', { id: busId, idx: i, msg: v.msg, errors: v.errors }); } catch (_) {}
				if (typeof onInvalid === 'function') try { onInvalid(v); } catch (_) {}
				return;
			}
			setIdx(j);
			if (bus) try { bus.emit('step', { id: busId, idx: j, values: values || {} }); } catch (_) {}
		};

		const indicator = () =>
			div({ style: 'display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap' })(
				steps.map((s, n) => button({
					className: `btn btn-ghost btn-sm${n === i ? ' active' : ''}`,
					type: 'button',
					onclick: () => goTo(n),
					style: n === i ? 'font-weight:700;color:var(--accent);' : '',
				})([s.title || String(n + 1)]))
			);

		const validationRes = checkValidation();
		const validatorMsg = validationRes && validationRes.msg ? validationRes.msg : null;
		const showMsg = showValidation && (validationMsg || validatorMsg);
		const msgToShow = showValidation ? (validationMsg || validatorMsg) : null;

		return Card({ title: step.title || `Step ${i + 1}`, className, style })([
			...(steps.length > 1 ? [indicator()] : []),
			div({})([ typeof step.render === 'function' ? step.render({ values: values || {}, setValue, idx: i, next, prev, goTo, validation: validationRes, showValidation, validationMsg: msgToShow }) : (step.render || div({})([])) ]),
			...(showMsg ? [div({ style: 'color:var(--danger);margin-top:10px' })([msgToShow])] : []),
			div({ style: 'display:flex;gap:8px;justify-content:flex-end;margin-top:12px' })([
				button({ className: 'btn btn-ghost', onclick: prev, type: 'button', disabled: i === 0 })(['Prev']),
				button({ className: 'btn btn-primary', onclick: next, type: 'button' })([i >= steps.length - 1 ? 'Finish' : 'Next']),
			]),
		]);
	};

export { MultiStep };

