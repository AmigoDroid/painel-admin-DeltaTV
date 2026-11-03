import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {toCents,moneyInput} from '../src/money.js';
const source=fs.readFileSync(new URL('../src/api.js',import.meta.url),'utf8').replaceAll('import.meta.env.VITE_API_URL','undefined');
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
const response=(status,data)=>({ok:status<400,status,json:async()=>data});
const initial={accessToken:'old',refreshToken:'refresh-old',user:{id:'test'}};
let sequence=0;
async function client(fetcher){
 const values=new Map();const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 for(const key of ['iptv-admin-auth','iptv-reseller-auth','iptv-content-partner-auth'])storage.setItem(key,JSON.stringify(initial));
 globalThis.localStorage=storage;globalThis.window=new EventTarget();globalThis.fetch=fetcher;
 return import('data:text/javascript;base64,'+Buffer.from(source+`\n// case ${++sequence}`).toString('base64'));
}
test('BRL values convert exactly and reject ambiguous or unsafe values',()=>{
 for(const [input,value] of [['29,90',2990],['10.50',1050],['1.234,56',123456],['R$ 1.234,56',123456],['1.234',123400],['0',0]])assert.equal(toCents(input),value,input);
 for(const input of ['', 'abc', '-1', '1,2,3', '12.345,678','9999999999999999999999999'])assert.equal(toCents(input),null,input);
 assert.equal(moneyInput(2990),'29,90');assert.equal(moneyInput(null),'');
});
test('parallel unauthorized requests rotate refresh only once',async()=>{
 let rotations=0;const gate=defer();
 const api=await client(async(url,opts)=>{
  if(String(url).endsWith('/auth/refresh')){rotations++;await gate.promise;return response(200,{...initial,accessToken:'new',refreshToken:'refresh-new'});}
  return opts.headers.Authorization==='Bearer new'?response(200,{ok:true}):response(401,{code:'INVALID_TOKEN'});
 });
 const work=Promise.all([api.api('/test'),api.api('/test')]);await new Promise(r=>setTimeout(r,0));gate.resolve();await work;assert.equal(rotations,1);
});
test('late 401 reuses a completed refresh instead of rotating twice',async()=>{
 let rotations=0,requests=0;const late=defer();
 const api=await client(async(url,opts)=>{
  if(String(url).endsWith('/auth/refresh')){rotations++;return response(200,{...initial,accessToken:'new',refreshToken:'refresh-new'});}
  if(opts.headers.Authorization==='Bearer new')return response(200,{ok:true});
  if(++requests===2)return late.promise;
  return response(401,{code:'INVALID_TOKEN'});
 });
 const first=api.api('/first'),second=api.api('/second');await first;late.resolve(response(401,{code:'INVALID_TOKEN'}));await second;assert.equal(rotations,1);
});
test('logout during refresh cannot restore an ended session',async()=>{
 const gate=defer(),started=defer();
 const api=await client(async(url)=>{
  if(String(url).endsWith('/auth/logout'))return response(204,null);
  if(String(url).endsWith('/auth/refresh')){started.resolve();await gate.promise;return response(200,{...initial,accessToken:'new'});}
  return response(401,{code:'INVALID_TOKEN'});
 });
 const request=api.api('/test').catch(e=>e);await started.promise;await api.logout();gate.resolve();await request;assert.equal(api.getAuth(),null);
});
test('temporary network failure during refresh keeps the session',async()=>{
 const api=await client(async(url)=>{if(String(url).endsWith('/auth/refresh'))throw Error('offline');return response(401,{code:'INVALID_TOKEN'})});
 await assert.rejects(api.api('/test'));assert.equal(api.getAuth().refreshToken,initial.refreshToken);
});
test('invalid refresh clears authentication',async()=>{
 const api=await client(async()=>response(401,{code:'INVALID_TOKEN'}));await assert.rejects(api.api('/test'));assert.equal(api.getAuth(),null);
});
test('credential rejection does not retry the operation or refresh session',async()=>{
 let requests=0;const api=await client(async()=>{requests++;return response(401,{code:'INVALID_CREDENTIALS'})});
 await assert.rejects(api.api('/configure'));assert.equal(requests,1);assert.equal(api.getAuth().refreshToken,initial.refreshToken);
});
test('AbortSignal reaches fetch and cancellation remains an AbortError',async()=>{
 const controller=new AbortController();controller.abort();let observed;
 const api=await client(async(_url,opts)=>{observed=opts.signal;throw new DOMException('Cancelled','AbortError')});
 await assert.rejects(api.api('/test',{signal:controller.signal}),{name:'AbortError'});assert.equal(observed,controller.signal);
});
test('socket can proactively renew an expired access token',async()=>{
 let rotations=0;const api=await client(async()=>{rotations++;return response(200,{...initial,accessToken:'new'})});
 assert.equal(await api.ensureAccessToken(),'new');assert.equal(rotations,1);
});
