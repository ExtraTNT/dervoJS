/**
 * Scenes for the demo game. Composes engine helpers (Scene, Choice,
 * NpcChoices, NpcLine, withTick) and pre-built widgets (Inventory, Shop).
 *
 * Combat lives in combat.js - its scene id is 'combat'.
 */

import {
  p, Alert, Badge,
  Scene, NpcChoices, NpcLine, withTick,
  Inventory, Shop,
} from '../src/index.js';
import { ITEMS } from './items.js';
import { startCombat, combatScene } from './combat.js';

//  tiny helpers 

const _train = (stat, cost = 0) => withTick(c => c.setState(s => ({
  [stat]: s[stat] + 1,
  energy: s.energy - 1,
  gold:   s.gold - cost,
})));

const _hasEnergy = c => c.state.energy > 0;

// Builds a basic train-at-location scene with NPC line + back-to-town choice.
const _location = ({ title, flavour, stat, cost = 0 }) => ctx => Scene({
  title,
  body: [
    p({})([flavour]),
    ...NpcLine(ctx),
    p({})([ctx.state.energy === 0
      ? "You're exhausted. Rest at the tavern."
      : `Energy: ${ctx.state.energy}/${ctx.state.maxEnergy}${cost ? ` · ${cost}g per session` : ''}`,
    ]),
  ],
  choices: [
    { label:  `Train ${stat} (-1 energy${cost ? `, -${cost}g` : ''}, +1 ${stat})`,
      action: _train(stat, cost),
      if:     c => _hasEnergy(c) && c.state.gold >= cost },
    ...NpcChoices(ctx),
    { label: 'Back to town', to: 'town' },
  ],
})(ctx);

// scenes 

export const scenes = {

  town: ctx => Scene({
    title: 'Town Square',
    body: [
      p({})(['The town square is alive with chatter. A fountain bubbles at the centre.']),
      ...NpcLine(ctx),
    ],
    choices: [
      { label: 'Visit the Gym',     to: 'gym' },
      { label: 'Visit the Library', to: 'library' },
      { label: 'Visit the Track',   to: 'track' },
      { label: 'Visit the Tavern',  to: 'tavern' },
      { label: 'Browse the Shop',   to: 'shop' },
      { label: 'Open Wardrobe',     to: 'wardrobe' },
      { label: 'Town Gate',         to: 'townGate' },
      ...NpcChoices(ctx),
    ],
  })(ctx),

  gym:     _location({ title: 'The Gym',     stat: 'STR', flavour: 'Iron clangs. The smell of chalk and sweat hangs heavy in the air.' }),
  library: _location({ title: 'The Library', stat: 'INT', flavour: 'Quiet. Dust motes drift through shafts of sunlight between tall shelves.' }),
  track:   _location({ title: 'The Track',   stat: 'AGI', flavour: 'A long dirt oval. Runners stretch by the rail; a coach watches with crossed arms.' }),

  tavern: ctx => Scene({
    title: 'The Tavern',
    body: [
      p({})(['The hearth crackles. Patrons crowd the bar; someone laughs too loudly in the corner.']),
      ...NpcLine(ctx),
    ],
    choices: [
      { label: 'Chat with patrons (-1 energy, +1 CHA)',
        action: _train('CHA'),
        if:     _hasEnergy },
      { label: 'Rest by the fire (-10g, full energy + heal)',
        action: c => c.setState(s => ({ gold: s.gold - 10, energy: s.maxEnergy, HP: s.maxHP })),
        if:     c => c.state.gold >= 10 && (c.state.energy < c.state.maxEnergy || c.state.HP < c.state.maxHP) },
      { label: 'Run errands for the keep (+15g, -1 energy)',
        action: withTick(c => c.setState(s => ({ gold: s.gold + 15, energy: s.energy - 1 }))),
        if:     _hasEnergy },
      ...NpcChoices(ctx),
      { label: 'Back to town', to: 'town' },
    ],
  })(ctx),

  townGate: ctx => Scene({
    title: 'Town Gate',
    body: [
      p({})(['The wooden gate creaks in the wind. A cobbled path leads into the wilds beyond.']),
      ...(ctx.state.flags.bossSlain
        ? [Alert({ variant: 'success' })(['The land feels lighter since the Dark One fell.'])]
        : []),
    ],
    choices: [
      { label: 'Take the forest path', to: 'forestPath' },
      { label: 'Back to town',         to: 'town' },
    ],
  })(ctx),

  forestPath: ctx => Scene({
    title: 'Forest Path',
    body: [
      p({})(['Sun-dappled leaves overhead. Birds - and other things - chatter in the canopy.']),
      ...NpcLine(ctx),
      ...(!ctx.state.flags.caveKey ? [p({})(['Something glints between the roots of an old oak…'])] : []),
    ],
    choices: [
      { label: 'Hunt for monsters',
        action: c => startCombat(c, Math.random() < 0.5 ? 'goblin' : 'wolf', 'forestPath'),
        if:     _hasEnergy },
      { label: 'Pick herbs (-1 energy, +5g)',
        action: withTick(c => c.setState(s => ({ gold: s.gold + 5, energy: s.energy - 1 }))),
        if:     _hasEnergy },
      { label: 'Pry the glint loose (find Cave Key)',
        action: c => c.setState(s => ({ flags: { ...s.flags, caveKey: true } })),
        if:     c => !c.state.flags.caveKey },
      ...NpcChoices(ctx),
      { label: 'Continue to the bridge', to: 'oldBridge' },
      { label: 'Back to the gate',       to: 'townGate' },
    ],
  })(ctx),

  oldBridge: ctx => Scene({
    title: 'Old Bridge',
    body: [
      p({})(['The river roars beneath rotted planks.']),
      ctx.state.flags.bridgeOpen
        ? Alert({ variant: 'success' })(['The bridge is yours to cross - the troll is gone.'])
        : Alert({ variant: 'warning' })(['A massive troll bars the way, club in hand.']),
    ],
    choices: [
      ...(ctx.state.flags.bridgeOpen
        ? [{ label: "Cross to the Hermit's Hut", to: 'hermitHut' }]
        : [
            { label:  'Fight the troll',
              action: c => startCombat(c, 'troll', 'oldBridge', {
                onWin: s => ({ flags: { ...s.flags, bridgeOpen: true } }),
              }) },
            { label:  'Pay the toll (50g)',
              action: c => c.setState(s => ({ gold: s.gold - 50, flags: { ...s.flags, bridgeOpen: true } })),
              if:     c => c.state.gold >= 50 },
          ]),
      { label: 'Back to the forest', to: 'forestPath' },
    ],
  })(ctx),

  hermitHut: ctx => Scene({
    title: "Hermit's Hut",
    body: [
      p({})(['A low stone hut overhung with moss. Smoke curls from the chimney.']),
      ...NpcLine(ctx),
    ],
    choices: [
      ...NpcChoices(ctx),
      { label: 'Approach the dark cave', to: 'darkCave' },
      { label: 'Back to the bridge',     to: 'oldBridge' },
    ],
  })(ctx),

  darkCave: ctx => {
    if (!ctx.state.flags.caveKey) return Scene({
      title: 'Dark Cave',
      body: [
        p({})(['The mouth of the cave gapes black. A heavy iron padlock holds the gate shut.']),
        Alert({ variant: 'warning' })(['You need the Cave Key. Try the forest, or speak with the hermit.']),
      ],
      choices: [{ label: 'Back', to: 'hermitHut' }],
    })(ctx);

    if (ctx.state.flags.bossSlain) return Scene({
      title: 'Dark Cave',
      body: [
        p({})(['Calm air. Whatever lived here is gone.']),
        Badge({ variant: 'green' })(['Boss slain - you may walk freely.']),
      ],
      choices: [{ label: 'Back', to: 'hermitHut' }],
    })(ctx);

    return Scene({
      title: 'Dark Cave',
      body: [
        p({})(['Damp stone. The torch you brought sputters. Something shifts in the depths.']),
      ],
      choices: [
        { label: 'Explore deeper',
          action: c => startCombat(c, 'caveDweller', 'darkCave'),
          if:     _hasEnergy },
        { label: 'Confront the Dark One',
          action: c => startCombat(c, 'darkOne', 'darkCave', {
            onWin: s => ({ flags: { ...s.flags, bossSlain: true } }),
          }),
          if:     c => c.state.HP >= c.state.maxHP * 0.6 },
        { label: 'Retreat to the hermit', to: 'hermitHut' },
      ],
    })(ctx);
  },

  // Pre-built scene shapes - one line each.
  shop:     ctx => Shop({      ctx, items: ITEMS, returnTo: 'town' }),
  wardrobe: ctx => Inventory({ ctx, items: ITEMS, returnTo: 'town', slots: ['hat', 'shirt', 'pants', 'weapon'], title: 'Wardrobe' }),

  // Combat (state.combat populated by startCombat)
  combat:   combatScene,
};
