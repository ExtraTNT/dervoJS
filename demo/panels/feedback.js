import { div, Card, Alert, Badge, Button } from '../../src/index.js';
import { doc } from '../components/doc.js'

export const feedbackPanel = () =>
  div({})([
    Card({ title: 'Alerts' })([
      div({ style: 'display:flex; flex-direction:column; gap:10px' })([
        Alert({ variant: 'info' })(['Informational message.']),
        Alert({ variant: 'success' })(['Operation completed successfully.']),
        Alert({ variant: 'warning' })(['Proceed with caution.']),
        Alert({ variant: 'error' })(['An error occurred.']),
        Alert({ variant: 'info', showIcon: false })(['No icon variant.']),
      ]),
      doc([
`Alert({ variant: 'info' })(['Informational message.'])
Alert({ variant: 'success' })(['Operation completed successfully.'])
Alert({ variant: 'warning' })(['Proceed with caution.'])
Alert({ variant: 'error' })(['An error occurred.'])
Alert({ variant: 'info', showIcon: false })(['No icon variant.'])`
    ]),
    ]),
    div({ style: 'margin-top:16px' })([
      Card({ title: 'Badges' })([
        div({ style: 'display:flex; gap:8px; flex-wrap:wrap' })([
          Badge({ variant: 'blue' })(['Info']),
          Badge({ variant: 'green' })(['Active']),
          Badge({ variant: 'red' })(['Error']),
          Badge({ variant: 'yellow' })(['Warning']),
          Badge({ variant: 'gray' })(['Default']),
          Badge({ variant: 'purple' })(['New']),
        ]),
        doc([
`Badge({ variant: 'blue' })(['Info'])
Badge({ variant: 'green' })(['Active'])
Badge({ variant: 'red' })(['Error'])
Badge({ variant: 'yellow' })(['Warning'])
Badge({ variant: 'gray' })(['Default'])
Badge({ variant: 'purple' })(['New'])`          
        ]),
      ]),
    ]),
  ]);
