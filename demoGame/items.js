/**
 * Item catalogue + initial game state for the demoGame.
 *
 * Item shape:
 *   id        - unique key (also referenced from state.inventory / state.equipped)
 *   name      - display label
 *   slot      - 'hat' | 'shirt' | 'pants' | 'weapon'
 *   price     - gold cost in shop
 *   bonuses   - { STR?, AGI?, INT?, CHA? }  applied while equipped
 *   damage    - (weapons only) base damage added on attack
 *   color     - SVG fill colour for the layered character
 *   kind      - hats: 'cap' | 'hood' | 'crown' · weapons: 'fist' | 'club' | 'sword' | 'staff' for shape choice
 */

export const ITEMS = {
  // shirts
  rags:        { id: 'rags',        name: 'Tattered Rags',    slot: 'shirt', price: 0,   bonuses: { CHA: -1 },           color: '#8b7355' },
  tunic:       { id: 'tunic',       name: 'Cloth Tunic',      slot: 'shirt', price: 30,  bonuses: {},                    color: '#3e6b48' },
  scholarRobe: { id: 'scholarRobe', name: "Scholar's Robe",   slot: 'shirt', price: 80,  bonuses: { INT: 2 },            color: '#2b3a67' },
  athleteVest: { id: 'athleteVest', name: 'Athletic Vest',    slot: 'shirt', price: 60,  bonuses: { STR: 1, AGI: 1 },    color: '#c0392b' },
  nobleSilk:   { id: 'nobleSilk',   name: "Noble's Silk",     slot: 'shirt', price: 180, bonuses: { CHA: 3 },            color: '#8e44ad' },

  // pants
  shorts:      { id: 'shorts',      name: 'Shorts',           slot: 'pants', price: 0,   bonuses: { AGI: 1, CHA: -1 },   color: '#7f8c8d' },
  trousers:    { id: 'trousers',    name: 'Plain Trousers',   slot: 'pants', price: 25,  bonuses: {},                    color: '#3a4a5b' },
  leatherPants:{ id: 'leatherPants',name: 'Leather Pants',    slot: 'pants', price: 70,  bonuses: { STR: 1, AGI: 1 },    color: '#6b3410' },
  silkPants:   { id: 'silkPants',   name: 'Silk Pants',       slot: 'pants', price: 110, bonuses: { CHA: 2 },            color: '#5a2d6e' },

  // hats
  cap:         { id: 'cap',         name: 'Worn Cap',         slot: 'hat',   price: 15,  bonuses: {},                    color: '#7f8c8d', kind: 'cap'   },
  bandana:     { id: 'bandana',     name: 'Bandana',          slot: 'hat',   price: 20,  bonuses: { AGI: 1 },            color: '#e74c3c', kind: 'cap'   },
  hood:        { id: 'hood',        name: 'Dark Hood',        slot: 'hat',   price: 60,  bonuses: { AGI: 1, CHA: -1 },   color: '#2c3e50', kind: 'hood'  },
  scholarHat:  { id: 'scholarHat',  name: "Scholar's Hat",    slot: 'hat',   price: 75,  bonuses: { INT: 2 },            color: '#1f2d3d', kind: 'hood'  },
  tinCrown:    { id: 'tinCrown',    name: 'Tin Crown',        slot: 'hat',   price: 200, bonuses: { CHA: 4 },            color: '#f1c40f', kind: 'crown' },

  // weapons (slot 'weapon', `damage` adds to attacks)
  fists:       { id: 'fists',       name: 'Bare Fists',       slot: 'weapon', price: 0,   damage: 1, bonuses: {},        color: '#f3c79c', kind: 'fist'  },
  stick:       { id: 'stick',       name: 'Sturdy Stick',     slot: 'weapon', price: 18,  damage: 3, bonuses: {},        color: '#7a4d22', kind: 'club'  },
  shortsword:  { id: 'shortsword',  name: 'Short Sword',      slot: 'weapon', price: 90,  damage: 6, bonuses: { STR: 1 }, color: '#bdc3c7', kind: 'sword' },
  greatsword:  { id: 'greatsword',  name: 'Greatsword',       slot: 'weapon', price: 240, damage: 10, bonuses: { STR: 2 }, color: '#95a5a6', kind: 'sword' },
  wizardStaff: { id: 'wizardStaff', name: 'Wizard Staff',     slot: 'weapon', price: 140, damage: 4, bonuses: { INT: 3 }, color: '#5e3a1f', kind: 'staff' },
};

//  initial game state 

export const initial = {
  // stats
  STR: 5, AGI: 5, INT: 5, CHA: 5,
  // vitality
  HP: 20, maxHP: 20,
  // resources
  gold: 50,
  energy: 10, maxEnergy: 10,
  // possessions
  inventory: ['rags', 'shorts', 'fists'],
  equipped:  { hat: null, shirt: 'rags', pants: 'shorts', weapon: 'fists' },
  // shop stock - items get removed when bought
  shopStock: [
    'tunic', 'scholarRobe', 'athleteVest', 'nobleSilk',
    'trousers', 'leatherPants', 'silkPants',
    'cap', 'bandana', 'hood', 'scholarHat', 'tinCrown',
    'stick', 'shortsword', 'greatsword', 'wizardStaff',
  ],
  // npcLocations is auto-seeded by the engine from each NPC's locations[0].
  // quest flags
  flags: {
    caveKey:    false,
    metHermit:  false,
    bridgeOpen: false,    // troll defeated or paid
    bossSlain:  false,
  },
  // combat - null when out of combat
  combat: null,
};

//  pure derivations 

/** Sum up the stat bonuses contributed by currently-equipped items. */
export const equipmentBonuses = equipped => {
  const bonus = { STR: 0, AGI: 0, INT: 0, CHA: 0 };
  for (const id of Object.values(equipped)) {
    if (!id) continue;
    const item = ITEMS[id];
    if (!item || !item.bonuses) continue;
    for (const [k, v] of Object.entries(item.bonuses)) {
      bonus[k] = (bonus[k] || 0) + v;
    }
  }
  return bonus;
};

/** Format a bonuses object as a short summary like "STR +1 · CHA -1". */
export const formatBonuses = bonuses =>
  Object.entries(bonuses || {})
    .filter(([, v]) => v !== 0)
    .map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`)
    .join(' · ') || '-';
