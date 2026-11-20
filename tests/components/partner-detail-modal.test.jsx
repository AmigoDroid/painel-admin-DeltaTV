/** @vitest-environment jsdom */
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {UiProvider} from '../../src/ui.jsx';
import NetworkWorkspace from '../../src/pages/NetworkWorkspace.jsx';
import PartnerDetailModal from '../../src/pages/PartnerDetailModal.jsx';

// O mock substitui somente a rede; o JSX, o hook de estado e o Dialog são reais.
const mocks = vi.hoisted(() => ({
  user: {role:'admin', permissions:['network:partners:read']},
  requests: [],
  partner: {
    id:'11111111-1111-4111-8111-111111111111',
    name:'Parceiro Alpha', kind:'content', slug:'parceiro-alpha',
    status:'active', effectiveStatus:'expired', endsAt:'2026-11-01T12:00:00.000Z',
    monthlyFeeCents:4500, deviceLimit:50, startsAt:'2026-01-01T00:00:00.000Z',
  },
}));
vi.mock('../../src/api.js', async importOriginal => ({
  ...(await importOriginal()),
  getAuth: () => ({user:mocks.user}),
  api: vi.fn(async (path, options = {}) => {
    mocks.requests.push({path,options});
    if (path === '/admin/workspace/partners')
      return {data:[mocks.partner],meta:{page:1,pageSize:20,total:1,totalPages:1}};
    if (path === `/admin/workspace/partners/${mocks.partner.id}`)
      return {partner:mocks.partner,contract:null,plan:null,users:[]};
    if (/^\/admin\/workspace\/partners\/[^/]+\/(codes|providers|invoices|devices)$/.test(path))
      return {data:[],meta:{page:1,totalPages:1}};
    if (path === `/admin/partners/${mocks.partner.id}/devices`) return {data:[]};
    if (path === `/admin/partners/${mocks.partner.id}`)
      return {...mocks.partner, codes:[],providers:[],invoices:[], billingModel:'fixed',
        deviceCount:0, dueDay:10, graceDays:2};
    if (path === '/admin/workspace/invitations' || path === '/admin/workspace/invitations/plans' || path === '/admin/workspace/plans') return {data:[],meta:{page:1,totalPages:1}};
    if (path.endsWith('/summary')) return {partners:1,resellers:0,activePartners:0,activeResellers:0,expired:1,pending:0,plans:0};
    throw new Error(`Requisição inesperada no teste: ${path}`);
  }),
}));

const mount = () => render(<UiProvider><NetworkWorkspace section="partners" /></UiProvider>);
const manage = async () => {
  const manageButton = await screen.findByRole('button',{name:'Gerenciar'});
  fireEvent.click(manageButton);
  return screen.getByRole('dialog',{name:mocks.partner.name});
};

beforeEach(() => {
  mocks.user = {role:'admin',permissions:['network:partners:read']};
  mocks.requests.length = 0;
});
afterEach(() => { cleanup(); });

describe('Ficha compartilhada de parceiros — Admin', () => {
  it('Gerenciar abre o diálogo largo com nome e badge de vencimento, jamais um card de ficha inline', async () => {
    const {container} = mount();
    const dialog = await manage();
    expect(dialog.classList.contains('wide')).toBe(true);
    expect(within(dialog).getByRole('button',{name:'Fechar'})).toBeTruthy();
    expect([...container.querySelectorAll('.card')].filter(el => el.querySelector('h3')?.textContent === mocks.partner.name)).toHaveLength(0);
    await waitFor(() => expect(within(dialog).getByText('Expirada')).toBeTruthy());
    expect(mocks.requests.every(r=>r.path.startsWith('/admin/workspace/'))).toBe(true);
  });

  it('Esc fecha o modal e restaura a tabela', async () => {
    mount(); await manage();
    fireEvent.keyDown(document,{key:'Escape'});
    await waitFor(() => expect(screen.queryByRole('dialog',{name:mocks.partner.name})).toBeNull());
    expect(screen.getByText(mocks.partner.name)).toBeTruthy();
  });

  it('clique no backdrop fecha o modal, sem fechar ao clicar dentro dele', async () => {
    mount();const dialog=await manage();
    fireEvent.mouseDown(dialog);
    expect(screen.getByRole('dialog',{name:mocks.partner.name})).toBeTruthy();
    fireEvent.mouseDown(dialog.parentElement);
    await waitFor(()=>expect(screen.queryByRole('dialog',{name:mocks.partner.name})).toBeNull());
  });

  it('sem permissão de escrita/exclusão não exibe ações restritas nem APIs globais', async () => {
    mount();const dialog=await manage();
    await waitFor(()=>expect(within(dialog).getByText('Expirada')).toBeTruthy());
    for(const name of ['Editar parceiro e contrato','Excluir revenda / parceiro','Renovar +1 mês','Bloquear','Suspender'])
      expect(within(dialog).queryByRole('button',{name})).toBeNull();
    expect(mocks.requests.every(r=>!r.path.startsWith('/admin/partners/'))).toBe(true);
  });

  it('edita contrato em submodal empilhado; Esc fecha apenas o de cima', async () => {
    mocks.user.permissions.push('network:partners:write');
    mount();await manage();
    const edit = await screen.findByRole('button',{name:'Editar parceiro e contrato'});
    fireEvent.click(edit);
    await waitFor(()=>expect(screen.getAllByRole('dialog')).toHaveLength(2));
    expect(screen.getByRole('dialog',{name:'Editar parceiro e contrato'})).toBeTruthy();
    fireEvent.keyDown(document,{key:'Escape'});
    await waitFor(()=>expect(screen.getAllByRole('dialog')).toHaveLength(1));
    expect(screen.getByRole('dialog',{name:mocks.partner.name})).toBeTruthy();
  });
});

describe('Ficha original do Superadmin', () => {
  it('usa o mesmo PartnerDetailModal e conserva ações globais exclusivas', async () => {
    mocks.user = {role:'superadmin',permissions:[]};
    render(<UiProvider><PartnerDetailModal id={mocks.partner.id} role="superadmin"
      basePath="/admin/partners" partnerName={mocks.partner.name} onClose={()=>{}} /> </UiProvider>);
    const dialog=await screen.findByRole('dialog',{name:mocks.partner.name});
    expect(await within(dialog).findByText('Expirada')).toBeTruthy();
    expect(within(dialog).getByRole('button',{name:'Renovar +1 mês'})).toBeTruthy();
    expect(within(dialog).getByRole('button',{name:'Excluir revenda / parceiro'})).toBeTruthy();
  });
});
