import { div, Card, Button, Modal, p, Alert } from '../../src/index.js';
import { setState } from '../store.js';
import { doc } from '../components/doc.js';

export const modalPanel = state =>
  div({})([
    Card({ title: 'Modal dialog' })([
      p({})(['Click the button to open a modal overlay.']),
      Button({ onClick: () => setState({ showModal: true }) })(['Open modal']),
      doc([`Modal({
  open: state.showModal,
  title: 'Confirm action',
  onClose: () => setState({ showModal: false }),
  footer: [
    Button({ variant: 'secondary', onClick: () => setState({ showModal: false }) })(['Cancel']),
    Button({ variant: 'danger',    onClick: () => setState({ showModal: false }) })(['Delete']),
  ],
})([
  p({})(['Are you sure you want to proceed?']),
  Alert({ variant: 'warning' })(['This is a destructive operation.']),
])`]),
    ]),

    Modal({
      open: state.showModal,
      title: 'Confirm action',
      onClose: () => setState({ showModal: false }),
      footer: [
        Button({ variant: 'secondary', onClick: () => setState({ showModal: false }) })(['Cancel']),
        Button({ variant: 'danger', onClick: () =>
          setState({ showModal: false })
        })(['Delete']),
      ],
    })([
      p({})(['Are you sure you want to proceed? This action cannot be undone.']),
      Alert({ variant: 'warning' })(['This is a destructive operation.']),
    ]),
  ]);
