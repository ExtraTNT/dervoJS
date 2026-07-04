/**
 * Hero Trainer - small demo game built on dervoJS's game module.
 */

import { initStyles, createGame } from '../src/index.js';
import { initial }  from './items.js';
import { scenes }   from './scenes.js';
import { NPCS }     from './world.js';
import { Sidebar }  from './character.js';

initStyles({noLink: true});
document.body.style.cssText = 'padding:0; margin:0';

const game = createGame({
  title:   'Hero Trainer',
  start:   'town',
  state:   initial,
  scenes,
  npcs:    NPCS,
  sidebar: Sidebar,
  debug:   true,
});

game.mount(document.body);
