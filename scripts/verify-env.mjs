/** Verificação de API do build standalone/monorepo. Lê também .env.production, como faz o Vite. */
import { existsSync, readFileSync } from 'node:fs';
const envFile=(name)=>{
  if(!existsSync(name))return {};
  const data={};
  for(const line of readFileSync(name,'utf8').split(/\r?\n/)){
    const match=line.match(/^\s*(?:export\s+)?([\w]+)\s*=\s*(.*?)\s*$/);
    if(!match)continue;
    const val=match[2].trim();
    data[match[1]]=val.replace(/^("|')([\s\S]*)\1$/, '$2');
  }
  return data;
};
const url=process.env.VITE_API_URL || envFile('.env.production').VITE_API_URL || envFile('.env').VITE_API_URL;
if (!url) { console.error('Configure VITE_API_URL=https://api.deltatv.com.br em .env.production.');process.exit(1); }
try {
  const parsed=new URL(url);
  if(parsed.protocol!=='https:' || !parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname!=='/') throw new Error('URL inválida');
  console.log('API validada:', parsed.origin);
} catch { console.error('VITE_API_URL deve ser a origem da API HTTPS, sem credenciais, caminhos nem parâmetros.');process.exit(1); }
