/**
 * Shared quest-pipeline helpers - used by every builder that wants the same
 * three-topic (offer / progress / turn-in) shape plus the Quest Log room +
 * 📜 sidebar link.
 *
 * Both the dedicated questGiver builder and the bulk randomNpcs builder rely
 * on this module so a player sees one consistent quest UX regardless of which
 * wizard scaffolded the giver - same flag names, same log entries, same menu
 * choice shape.
 *
 * The three sub-topics return to the calling Menu via `flow: 'exitBack'`
 * (which POPS the topic stack), not `flow: 'change'` back to Menu (which
 * would PUSH the calling topic again, leaving Goodbye stranded on a stack
 * that pops back into a completed turn-in). See questGiver.js comments for
 * the full reasoning.
 */

import {
  emptyTopic, emptyChoice, emptyPage, emptyEffect, emptyCondition,
  _rid,
} from '../../schema.js';
import { ensureSidebarWidget } from '../../helpers.js';

// ── op shape helper ──────────────────────────────────────────────────────────

// Build a simple-mode op shape with the optional condition / min / max
// fields populated so the EffectEditor doesn't trip on undefined.
const makeOpSimple = (target, op, value) => ({
  target, op, value,
  condition: emptyCondition(),
  min: { enabled: false, statKey: '', mul: 0, const: 0 },
  max: { enabled: false, statKey: '', mul: 0, const: 0 },
});

// ── Quest Log room + sidebar link ────────────────────────────────────────────

// Idempotent: returns the project unchanged when the quest_log room already
// exists. The sidebar widget guard uses ensureSidebarWidget so it never gets
// added twice either, even after slot switches or repeated builder runs.
const ensureQuestLog = project => {
  let log = project.rooms.find(r => r.id === 'quest_log');
  let next = project;
  if (!log) {
    const backChoice = {
      ...emptyChoice(),
      label:  '← Back',
      to:     '',
      action: { ...emptyEffect(), mode: 'js', body: 'if (c.history && c.history.length) c.back();' },
    };
    log = {
      id:               'quest_log',
      kind:             'scene',
      title:            'Quest Log',
      folder:           'system',
      music:            '',
      onEnter:          emptyEffect(),
      onEnterCondition: emptyCondition(),
      pages:            [{ ...emptyPage(), text: 'Your active and completed quests.', advanceLabel: 'OK' }],
      choices:          [backChoice],
      onEnd:            emptyEffect(),
      wardrobe:         { portraitWidth: 240, portraitHeight: 320, layers: [], kinds: ['equipment'] },
    };
    next = { ...next, rooms: [...next.rooms, log] };
  }
  next = ensureSidebarWidget(w => w.type === 'roomLink' && w.roomId === 'quest_log')({
    id:     _rid(),
    type:   'roomLink',
    label:  'Quests',
    roomId: 'quest_log',
    icon:   '📜',
  })(next);
  return next;
};

// Append two display rows to the quest_log room - one for the active state,
// one for the done state. Both have `to: ''` so clicking just stays put;
// the rows are visual indicators only.
const appendQuestLogEntries = (qid, questTitle) => project => {
  const startedKey = `q_${qid}_started`;
  const doneKey    = `q_${qid}_done`;
  const doneRow = {
    ...emptyChoice(),
    label:     `✓ ${questTitle}`,
    to:        '',
    condition: { ...emptyCondition(), mode: 'simple', key: `flags.${doneKey}`, op: '==', value: true },
  };
  const activeRow = {
    ...emptyChoice(),
    label:     `• ${questTitle} (active)`,
    to:        '',
    condition: { ...emptyCondition(), mode: 'js', expr: `c.state.flags?.${startedKey} && !c.state.flags?.${doneKey}` },
  };
  return {
    ...project,
    rooms: project.rooms.map(r => r.id === 'quest_log'
      ? { ...r, choices: [...(r.choices || []), activeRow, doneRow] }
      : r),
  };
};

// ── per-quest sub-topic builders ─────────────────────────────────────────────

// The offer topic - shows the quest pitch, Accept sets the started flag and
// pops back to the menu, Decline pops back without changes.
const offerTopic = ({ id, qid, title, offerText }) => ({
  ...emptyTopic(),
  id,
  name:  `Offer: ${title}`,
  pages: [{ ...emptyPage(), text: offerText || 'Help me with this task.', advanceLabel: 'More' }],
  choices: [
    {
      ...emptyChoice(),
      label:  'I\'ll do it.',
      flow:   'exitBack',
      action: { ...emptyEffect(), mode: 'simple', ops: [makeOpSimple(`flags.q_${qid}_started`, 'set', true)] },
    },
    { ...emptyChoice(), label: 'Maybe later.', flow: 'exitBack' },
  ],
});

// The progress topic - single hint page + a single back choice.
const progressTopic = ({ id, title, progressHint }) => ({
  ...emptyTopic(),
  id,
  name:  `Progress: ${title}`,
  pages: [{ ...emptyPage(), text: progressHint || 'Keep at it.', advanceLabel: 'OK' }],
  choices: [{ ...emptyChoice(), label: 'I\'ll get back to it.', flow: 'exitBack' }],
});

// The turn-in topic - onEnter fires the reward + flips the done flag, the
// page shows the done text, the single back choice pops to the menu. Callers
// can pass `extraOps` (e.g. `inv.<id> take N` for fetch quests, or a stat
// reward) which are spliced in BEFORE the done-flag op so the flag-set runs
// last and the new state is visible after the effect.
const turninTopic = ({ id, qid, title, doneText, extraOps = [] }) => {
  const doneKey = `q_${qid}_done`;
  const ops = [
    ...extraOps,
    makeOpSimple(`flags.${doneKey}`, 'set', true),
  ];
  return {
    ...emptyTopic(),
    id,
    name:  `Turn-in: ${title}`,
    onEnter: { ...emptyEffect(), mode: 'simple', ops },
    pages: [{ ...emptyPage(), text: doneText || 'Thank you.', advanceLabel: 'OK' }],
    choices: [{ ...emptyChoice(), label: 'Anything else?', flow: 'exitBack' }],
  };
};

// ── menu choices for one quest ───────────────────────────────────────────────

// Three menu choices for one quest. `pickupExpr` and `completionExpr` let
// callers tighten the gates beyond the defaults:
//   pickupExpr null     → "!started" - always offer until accepted
//   completionExpr null → no extra clause; player can self-finish
const menuChoicesForQuest = ({ qid, title, subTopicIds, pickupExpr, completionExpr }) => {
  const startedKey = `q_${qid}_started`;
  const doneKey    = `q_${qid}_done`;
  const pickup     = pickupExpr     || `!c.state.flags?.${startedKey}`;
  const inProgress = `c.state.flags?.${startedKey} && !c.state.flags?.${doneKey}`;
  const completion = completionExpr ? `${inProgress} && (${completionExpr})` : inProgress;
  return [
    {
      ...emptyChoice(),
      label:     `Tell me about ${title}.`,
      flow:      'change',
      topicId:   subTopicIds.offer,
      condition: { ...emptyCondition(), mode: 'js', expr: pickup },
    },
    {
      ...emptyChoice(),
      label:     `How is "${title}" going?`,
      flow:      'change',
      topicId:   subTopicIds.progress,
      condition: { ...emptyCondition(), mode: 'js', expr: inProgress },
    },
    {
      ...emptyChoice(),
      label:     `I've finished "${title}"!`,
      flow:      'change',
      topicId:   subTopicIds.turnin,
      condition: { ...emptyCondition(), mode: 'js', expr: completion },
    },
  ];
};

// ── shared completion-expression for the three goal types ────────────────────

// Take a normalised quest goal descriptor and produce the JS expression that
// the menu's "I've finished" choice gates on. The shape:
//   { goalType: 'fetch', fetchItemId, fetchCount }
//   { goalType: 'fight', fightCombatFlag }   (e.g. `combat_<id>_won`)
//   { goalType: 'flag',  flagKey, flagValue: true|false }
// Falls back to `'true'` when a goal is mis-configured so the choice still
// renders (the builder validators catch that case upstream).
const goalCompletionExpr = goal => {
  if (!goal) return 'true';
  if (goal.goalType === 'fetch') {
    if (!goal.fetchItemId) return 'true';
    const count = Math.max(1, Number(goal.fetchCount) || 1);
    return `(c.state.inventory?.[${JSON.stringify(goal.fetchItemId)}] || 0) >= ${count}`;
  }
  if (goal.goalType === 'fight') {
    if (!goal.fightCombatFlag) return 'true';
    return `!!c.state.flags?.${goal.fightCombatFlag}`;
  }
  if (goal.goalType === 'flag') {
    if (!goal.flagKey) return 'true';
    return goal.flagValue
      ? `!!c.state.flags?.${goal.flagKey}`
      : `!c.state.flags?.${goal.flagKey}`;
  }
  return 'true';
};

// ── inject a flag-set into a combat's onWin ──────────────────────────────────

// Used by fight-goal quests so winning a chosen combat flips a tracked flag.
// Idempotent: bails out when the flag-set op is already present, and wraps a
// non-simple existing onWin in a `multi` so the original logic is preserved.
const injectCombatWinFlag = (combatId, flagKey) => project => {
  const combat = (project.combats || []).find(c => c.id === combatId);
  if (!combat) return project;
  const existingOps = combat.onWin?.mode === 'simple' ? (combat.onWin.ops || []) : [];
  const already = existingOps.some(o => o.target === `flags.${flagKey}` && o.op === 'set' && o.value === true);
  if (already && combat.onWin?.mode === 'simple') return project;
  const flagOp = makeOpSimple(`flags.${flagKey}`, 'set', true);
  let nextOnWin;
  if (!combat.onWin || combat.onWin.mode === 'none') {
    nextOnWin = { ...emptyEffect(), mode: 'simple', ops: [flagOp] };
  } else if (combat.onWin.mode === 'simple') {
    nextOnWin = { ...combat.onWin, ops: [...existingOps, flagOp] };
  } else {
    nextOnWin = {
      ...emptyEffect(),
      mode: 'multi',
      steps: [combat.onWin, { ...emptyEffect(), mode: 'simple', ops: [flagOp] }],
    };
  }
  return {
    ...project,
    combats: project.combats.map(c => c.id === combatId ? { ...c, onWin: nextOnWin } : c),
  };
};

export {
  makeOpSimple,
  ensureQuestLog,
  appendQuestLogEntries,
  offerTopic,
  progressTopic,
  turninTopic,
  menuChoicesForQuest,
  goalCompletionExpr,
  injectCombatWinFlag,
};
