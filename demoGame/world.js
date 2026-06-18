/**
 * NPC + enemy data for the demo. Plain definitions only - the engine
 * handles dialogue routing and the world tick (see createGame's `npcs`
 * config and ctx.npcsAt / ctx.tickWorld / ctx.talkTo).
 */

import { p, Scene } from '../src/index.js';

export const NPCS = {
  eldra: {
    name:      'Eldra the Merchant',
    locations: ['town', 'tavern', 'shop'],
    greeting:  'Eldra the merchant adjusts her wares as you pass.',
    dialogue: ctx => {
      const back = ctx.scene;
      return Scene({
        title: 'Eldra the Merchant',
        body: [
          p({})(['"Word travels," she says with a glance at your boots. "There\'s coin in courier work - the inn keeps a list of names."']),
          p({})(['(She slips you 5 gold for the rumour.)']),
        ],
        choices: [
          { label: 'Take the gold', action: c => c.setState(s => ({ gold: s.gold + 5, _scene: back })) },
          { label: 'Refuse politely', action: c => c.setState({ _scene: back }) },
        ],
      })(ctx);
    },
  },

  brom: {
    name:      'Brom the Drunk',
    locations: ['tavern', 'town', 'forestPath'],
    greeting:  'Brom slouches against a wall, mug in hand.',
    dialogue: ctx => {
      const back = ctx.scene;
      return Scene({
        title: 'Brom the Drunk',
        body: [
          p({})(['"The bridge troll? Hah! Soft as old bread once you\'ve had a few." He winks. "Or just bribe him."']),
          p({})(['"Hermit\'s up the path past the bridge. Knows things a sober man shouldn\'t."']),
        ],
        choices: [
          { label: 'Buy him a drink (-3g, +1 CHA)',
            action: c => c.setState(s => ({ gold: s.gold - 3, CHA: s.CHA + 1, _scene: back })),
            if:     c => c.state.gold >= 3 },
          { label: 'Walk away', action: c => c.setState({ _scene: back }) },
        ],
      })(ctx);
    },
  },

  mara: {
    name:      'Mara the Hermit',
    locations: ['hermitHut'],
    greeting:  'Mara the hermit sits cross-legged by the fire.',
    dialogue: ctx => {
      const back = ctx.scene;
      return Scene({
        title: 'Mara the Hermit',
        body: [
          p({})(['"Few find their way here. You came to listen, or to ask?"']),
          p({})([ctx.state.flags.metHermit
            ? 'She studies you. "The cave key - you still need it. Look in the forest."'
            : 'She presses something cold into your palm. "An old key. There\'s a place that won\'t open without it."']),
        ],
        choices: [
          ...(!ctx.state.flags.metHermit
            ? [{ label: 'Take the key',
                 action: c => c.setState(s => ({
                   flags: { ...s.flags, metHermit: true, caveKey: true },
                   INT: s.INT + 1,
                   _scene: back,
                 })) }]
            : []),
          { label: 'Sit a while (full energy)',
            action: c => c.setState(s => ({ energy: s.maxEnergy, _scene: back })) },
          { label: 'Leave', action: c => c.setState({ _scene: back }) },
        ],
      })(ctx);
    },
  },
};

// enemies (used by combat.js)

export const ENEMIES = {
  goblin:      { id: 'goblin',      name: 'Forest Goblin', hp:  8, attack:  3, defense: 0, gold: 12,  flavour: 'A wiry goblin bares its teeth.',         color: '#5d8c3a' },
  wolf:        { id: 'wolf',        name: 'Lean Wolf',     hp: 12, attack:  5, defense: 1, gold:  8,  flavour: 'A wolf circles, fur bristling.',         color: '#7f8c8d' },
  troll:       { id: 'troll',       name: 'Bridge Troll',  hp: 28, attack:  7, defense: 2, gold: 60,  flavour: '"NO PASS," it grunts, raising its club.', color: '#4d6b1f' },
  caveDweller: { id: 'caveDweller', name: 'Cave Dweller',  hp: 16, attack:  6, defense: 1, gold: 24,  flavour: 'A pale figure unfolds from the dark.',   color: '#6c5b7b' },
  darkOne:     { id: 'darkOne',     name: 'The Dark One',  hp: 50, attack: 10, defense: 3, gold: 200, flavour: 'A cloaked shape steps from the shadows. The air goes cold.', color: '#1a1a2e' },
};
