/**
 * CRUD demo panel — wires up `createCrud` against an inline OpenAPI 3.0
 * spec and a fake in-memory backend (so the demo works with no server).
 *
 * Real apps would replace `fakeFetch` with the global `fetch` (or an
 * auth-wrapped one) and `spec` with the JSON returned from `/openapi.json`.
 */

import {
  div, p, span, code, strong, pre,
  Card, Alert, Badge,
  createHttp, createCrud,
} from '../../src/index.js';
import { setState, getState } from '../store.js';
import { doc } from '../components/doc.js';

// inline OpenAPI 3.0 spec
// Hand-written so the demo is self-contained. In real life this would come
// from your backend at /openapi.json (3.1 specs work too — the compiler
// handles `type: ['string', 'null']` and `examples` alongside the 3.0
// `nullable` / `example` keys).

const spec = {
  openapi: '3.0.3',
  info: { title: 'Demo API', version: '0.1.0' },
  paths: {
    '/users': {
      get:  { responses: { 200: { content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/User' } } } } } } },
      post: {
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/UserCreate' } } } },
        responses:   { 201: { content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } } },
      },
    },
    '/users/{id}': {
      get:    { responses: { 200: { content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } } } },
      patch:  {
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/UserCreate' } } } },
        responses:   { 200: { content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } } },
      },
      delete: { responses: { 204: {} } },
    },
  },
  components: {
    schemas: {
      User: {
        type: 'object',
        required: ['id', 'name', 'email', 'role'],
        properties: {
          id:        { type: 'integer', readOnly: true, title: 'ID' },
          name:      { type: 'string', minLength: 2, maxLength: 60, title: 'Full name' },
          email:     { type: 'string', format: 'email', title: 'Email' },
          age:       { type: 'integer', minimum: 0, maximum: 150, title: 'Age', nullable: true },
          role:      { type: 'string', enum: ['admin', 'editor', 'viewer'], title: 'Role' },
          active:    { type: 'boolean', default: true, title: 'Active' },
          joinedAt:  { type: 'string', format: 'date', title: 'Joined' },
          tags:      { type: 'array', items: { type: 'string' }, title: 'Tags' },
          address:   { $ref: '#/components/schemas/Address' },
        },
      },
      UserCreate: {
        type: 'object',
        required: ['name', 'email', 'role'],
        properties: {
          name:     { type: 'string', minLength: 2, maxLength: 60, title: 'Full name' },
          email:    { type: 'string', format: 'email', title: 'Email' },
          age:      { type: 'integer', minimum: 0, maximum: 150, title: 'Age', nullable: true },
          role:     { type: 'string', enum: ['admin', 'editor', 'viewer'], title: 'Role' },
          active:   { type: 'boolean', default: true, title: 'Active' },
          joinedAt: { type: 'string', format: 'date', title: 'Joined' },
          tags:     { type: 'array', items: { type: 'string' }, title: 'Tags' },
          address:  { $ref: '#/components/schemas/Address' },
        },
      },
      Address: {
        type: 'object',
        title: 'Address',
        properties: {
          street: { type: 'string', title: 'Street' },
          city:   { type: 'string', title: 'City' },
          zip:    { type: 'string', title: 'ZIP', pattern: '^[0-9A-Z\\- ]{3,10}$' },
        },
      },
    },
  },
};

// fake in-memory backend

let _seq = 5;
const _db = [
  { id: 1, name: 'Ada Lovelace',     email: 'ada@example.com',   age: 36,  role: 'admin',  active: true,  joinedAt: '1843-12-10', tags: ['founder','math'],   address: { street: '12 Babbage St',   city: 'London',    zip: 'EC1A 1AA' } },
  { id: 2, name: 'Alan Turing',      email: 'alan@example.com',  age: 41,  role: 'admin',  active: false, joinedAt: '1936-05-28', tags: ['logic','crypto'],   address: { street: '4 Bletchley Rd',  city: 'Milton K.', zip: 'MK3 6EB' } },
  { id: 3, name: 'Grace Hopper',     email: 'grace@example.com', age: 85,  role: 'editor', active: true,  joinedAt: '1959-01-15', tags: ['cobol'],            address: { street: '1 Compiler Way',  city: 'New York',  zip: '10001' } },
  { id: 4, name: 'Edsger Dijkstra',  email: 'edsger@example.com',age: 72,  role: 'viewer', active: true,  joinedAt: '1972-08-11', tags: ['algorithms'],       address: { street: '17 Graph Ave',    city: 'Eindhoven', zip: '5611 AZ' } },
  { id: 5, name: 'Margaret Hamilton',email: 'margaret@x.com',    age: 87,  role: 'admin',  active: true,  joinedAt: '1969-07-20', tags: ['nasa','apollo-11'], address: { street: '11 Moon Cir',     city: 'Boston',    zip: '02110' } },
];

const _delay = ms => new Promise(r => setTimeout(r, ms));

const _matchItem = url => {
  const m = url.match(/^\/api\/users\/(\d+)(?:\?.*)?$/);
  return m ? Number(m[1]) : null;
};

const _matchList = url => /^\/api\/users(?:\?.*)?$/.test(url);

const fakeFetch = async (url, init = {}) => {
  await _delay(150);
  const method = (init.method || 'GET').toUpperCase();
  const body   = init.body ? JSON.parse(init.body) : null;
  const id     = _matchItem(url);

  const json = (status, value, headers = {}) =>
    // 204/205 must have null body per fetch spec; otherwise stringify
    new Response(value == null || status === 204 || status === 205 ? null : JSON.stringify(value), {
      status, headers: { 'Content-Type': 'application/json', ...headers },
    });

  if (_matchList(url) && method === 'GET') {
    return json(200, _db, { 'x-total-count': String(_db.length) });
  }
  if (_matchList(url) && method === 'POST') {
    const next = { id: ++_seq, active: true, tags: [], ...body };
    _db.push(next);
    return json(201, next);
  }
  if (id != null && method === 'GET') {
    const row = _db.find(r => r.id === id);
    return row ? json(200, row) : json(404, { error: 'not found' });
  }
  if (id != null && (method === 'PUT' || method === 'PATCH')) {
    const i = _db.findIndex(r => r.id === id);
    if (i < 0) return json(404, { error: 'not found' });
    _db[i] = { ..._db[i], ...body, id };
    return json(200, _db[i]);
  }
  if (id != null && method === 'DELETE') {
    const i = _db.findIndex(r => r.id === id);
    if (i < 0) return json(404, { error: 'not found' });
    _db.splice(i, 1);
    return json(204, null);
  }
  return json(404, { error: `no route: ${method} ${url}` });
};

// factory: each curry step is reused 

const http     = createHttp(fakeFetch);              // bind 1 — auth/transport
const withApi  = createCrud(http)('/api');           // bind 2 — base path
const withSpec = withApi(spec);                      // bind 3 — service spec
const Users    = withSpec('users');                  // bind 4 — resource

// state slice plumbing 

const _initial = {
  view: 'list', id: null,
  data: undefined, total: null,
  loading: false, error: null,
  form: null, formErrors: {},
  submitting: false,
  confirmDelete: null,
  _loadedKey: null,
  filter: '', sort: null,
};

// scoped setState — write to state.crudDemo with merge semantics, also
// supporting the (prev => patch) updater form that CrudResource uses.
const patchCrud = patch => setState(s => {
  const cur  = s.crudDemo ?? _initial;
  const next = typeof patch === 'function' ? patch(cur) : patch;
  return { crudDemo: { ...cur, ...next } };
});

//   panel render 

export const crudPanel = state => {
  const cd = state.crudDemo ?? _initial;

  return div({})([
    Card({ title: 'CRUD from OpenAPI' })([
      p({ style: 'margin:0 0 8px; color:var(--text-muted)' })([
        'Single component renders ',
        strong({})(['list / show / new / edit / delete']),
        ' for any resource described by an OpenAPI 3.0 (or 3.1) document. ',
        'Form components and validators are picked automatically from the schema — ',
        code({})(['format: email']),
        ' → email input + validator, ',
        code({})(['enum']),
        ' → Select, ',
        code({})(['type: integer + minimum/maximum']),
        ' → NumberInput + range, nested objects → nested Cards, ',
        code({})(['type: array']),
        ' → add/remove repeater.',
      ]),
      div({ style: 'display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px' })([
        Badge({ variant: 'green'  })(['list']),
        Badge({ variant: 'green'  })(['show']),
        Badge({ variant: 'green'  })(['new']),
        Badge({ variant: 'green'  })(['edit (PATCH)']),
        Badge({ variant: 'red'    })(['delete']),
        Badge({ variant: 'gray'   })(['nested objects']),
        Badge({ variant: 'gray'   })(['arrays']),
        Badge({ variant: 'gray'   })(['enums']),
        Badge({ variant: 'gray'   })(['validators']),
      ]),
      Alert({ variant: 'info' })([
        'Backed by an in-memory fake API (',
        code({})(['fakeFetch']),
        ') so the demo runs with no server. Swap ',
        code({})(['createHttp(fakeFetch)']),
        ' for ',
        code({})(['createHttp()']),
        ' to talk to a real backend.',
      ]),
    ]),

    div({ style: 'margin-top:16px' })([
      Users({
        state:    cd,
        setState: patchCrud,
        view:     cd.view,
        id:       cd.id,
      }),
    ]),

    div({ style: 'margin-top:24px' })([
      Card({ title: 'How the partial application pays off' })([
        doc([
`import { createHttp, createCrud } from './src/index.js';

// One-time setup — each curry step gives a reusable handle
const http     = createHttp(myAuthedFetch);   //  bind auth/transport
const withApi  = createCrud(http)('/api');    //  bind base path
const withSpec = withApi(openapiSpec);        //  bind OpenAPI spec
const Users    = withSpec('users');           //  bind resource
const Projects = withSpec('projects');        //  another resource, same spec

// Per call site — pass state + setState, the rest is automatic
Users({ state: s.users, setState: patchUsers, view: 'list' });
Users({ state: s.users, setState: patchUsers, view: 'edit', id: 42 });
Projects({ state: s.projects, setState: patchProjects, view: 'new' });`
        ]),
      ]),
    ]),

    div({ style: 'margin-top:16px' })([
      Card({ title: 'Schema → component mapping' })([
        pre({ style: 'background:var(--surface-2); padding:12px; border-radius:var(--radius); margin:0; font-size:12px; overflow:auto' })([
`string                          → TextInput
string + format: email          → TextInput type=email + email() validator
string + format: date / date-time → DateTimePicker
string + enum: [...]            → Select
integer / number                → NumberInput + range() validator
integer/number + minimum/maximum → NumberInput min/max
boolean                         → Toggle
array  + items: <schema>        → repeating field (+ Add / ✕ row)
object + properties             → nested Card with recursive fields
required: [...]                 → required() validator on each field
readOnly: true                  → hidden from forms`
        ]),
      ]),
    ]),
  ]);
};
