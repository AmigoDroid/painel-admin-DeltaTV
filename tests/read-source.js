// Lê adapters e seus componentes compartilhados para as verificações estáticas legadas.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export function readFileSync(file, options) {
 const value=fs.readFileSync(file,options);
 if(typeof value!=='string')return value;
 const filename=file instanceof URL?fileURLToPath(file):String(file);
 if(!filename.endsWith('.jsx'))return value;
 const names=[...value.matchAll(/from\s+["']@deltatv\/ui\/([^"']+)["']/g)].map(m=>m[1]);
 const panel=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
 const pkg=JSON.parse(fs.readFileSync(path.join(panel,'vendor/deltatv-ui/package.json'),'utf8'));
 return value+names.map(name=>{const entry=pkg.exports['./'+name];return entry? '\n'+fs.readFileSync(path.join(panel,'vendor/deltatv-ui',entry),'utf8'):''}).join('');
}
export default {...fs,readFileSync};

export {existsSync, readdirSync, statSync} from "node:fs";
