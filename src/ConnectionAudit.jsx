/** Adapter do painel admin: transporte e sessão não são compartilhados. */
import SharedConnectionAudit from '@deltatv/ui/ConnectionAudit';
import { api } from './api.js';
export default function ConnectionAudit(props) { return <SharedConnectionAudit {...props} api={api} />; }
