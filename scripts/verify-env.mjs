/** Verifica a URL da API seguindo a ordem de configuração do Vite (build production). */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

const existing = process.env.VITE_API_URL;
const files = ['.env', '.env.local', '.env.production', '.env.production.local'];
const loaded = {};
for (const file of files) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) continue;
  Object.assign(loaded, parseEnv(readFileSync(path, 'utf8')));
}
const url = (existing ?? loaded.VITE_API_URL ?? '').trim();
if (!url) {
  console.error('VITE_API_URL ausente. Crie um arquivo .env.production com VITE_API_URL=https://api.deltatv.com.br');
  process.exit(1);
}
try {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
    throw new Error('URL invalida');
  }
} catch {
  console.error('VITE_API_URL deve ser uma URL base HTTPS, sem credenciais, caminhos ou parametros.');
  process.exit(1);
}
console.log('Configuracao de API validada:', url);
