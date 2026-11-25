import { createServer } from 'node:http';
import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile, readdir } from 'node:fs/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { adminPage,loginPage } from './admin-pages.mjs';
import { handle, limitedBytes, response } from './application.mjs';
import { root, mime, openStore } from './local-store.mjs';

const db=openStore(), files=new Map();
const publicDir=path.join(root,'public');
for(const name of await readdir(publicDir,{recursive:true,withFileTypes:true})){
  if(!name.isFile())continue;
  const full=path.join(name.parentPath,name.name);
  files.set('/'+path.relative(publicDir,full).split(path.sep).join('/'),full);
}
const readCatalog=db.prepare('SELECT revision,body FROM catalog WHERE id=1');
const saveCatalog=db.prepare('UPDATE catalog SET revision=?,body=? WHERE id=1 AND revision=?');
const admin=db.prepare('SELECT salt,digest FROM admin WHERE id=1');
const existing=db.prepare('SELECT 1 FROM uploads WHERE name=?');
const image=db.prepare('SELECT bytes FROM uploads WHERE name=?');
const saveImage=db.prepare('INSERT OR IGNORE INTO uploads(name,bytes) VALUES(?,?)');
const sessions=new Map(), failures=new Map(), derive=promisify(scrypt);
const secure=process.env.SHOWROOM_HTTPS==='1';
const cookieName=secure?'__Host-showroom_admin':'showroom_admin';
const cookie=(token,ttl)=>cookieName+'='+token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+ttl+(secure?'; Secure':'');
const token=req=>req.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
const redirect=(url,extra={})=>response(null,303,'text/plain',{Location:url,...extra});
const type=name=>mime[path.extname(name).slice(1).toLowerCase()]||'application/octet-stream';
function prune(){
  const now=Date.now();
  for(const [k,s] of sessions)if(s.until<=now)sessions.delete(k);
  for(const [k,f] of failures)if(f.until<=now)failures.delete(k);
}
const timer=setInterval(prune,60000);timer.unref();
const base={
 read(){const row=readCatalog.get();return {revision:row.revision,catalog:JSON.parse(row.body)}},
 save(data,previous){const next=randomUUID();return saveCatalog.run(next,JSON.stringify(data),previous).changes===1?next:null},
 hasImage(name){return files.has('/assets/'+name)||Boolean(existing.get(name))},
 putImage(name,bytes){saveImage.run(name,bytes)},
 getImage(name){const row=image.get(name);return row?response(row.bytes,200,type(name)):null},
 async asset(route){const file=files.get(route);return file?response(await readFile(file),200,type(file)):null},
 authorized(req){const s=sessions.get(token(req));return s && s.until>Date.now() && s.salt===admin.get()?.salt},
 loginPage(){return response(loginPage(false,Boolean(admin.get())))},
 adminPage(){return response(adminPage())},
 logout(req){sessions.delete(token(req));return redirect('/admin/',{'Set-Cookie':cookie('',0)})}
};
let running=0;
const host=process.env.HOST||'127.0.0.1';
const port=Number(process.env.PORT||3000);
createServer(async(incoming,out)=>{
 try{
   if(!incoming.url.startsWith('/')||incoming.url.startsWith('//')){out.writeHead(400).end();return}
   const origin=(secure?'https://':'http://')+incoming.headers.host;
   const method=incoming.method;
   const headers=new Headers();
   for(const [k,v] of Object.entries(incoming.headers))if(v!==undefined)headers.set(k,Array.isArray(v)?v.join(', '):v);
   const req=new Request(new URL(incoming.url,origin),{method,headers,...(['HEAD','GET'].includes(method)?{}:{body:Readable.toWeb(incoming),duplex:'half'})});
   const service={...base,async login(request){
     const ip=incoming.socket.remoteAddress||'local';
     const old=failures.get(ip);
     if((old?.until>Date.now() && old.count>=8)||running>=4)return redirect('/admin/?error=limit');
     const row=admin.get();
     if(!row)return redirect('/admin/');
     const data=new URLSearchParams(new TextDecoder().decode(await limitedBytes(request,2048)));
     const attempt=old?.until>Date.now()?old:{count:0,until:Date.now()+600000};
     attempt.count++;failures.set(ip,attempt);
     running++;
     let ok;
     try{
       const digest=await derive(data.get('password')||'',row.salt,64);
       ok=timingSafeEqual(digest,Buffer.from(row.digest,'hex')) && data.get('username')==='admin';
     }finally{running--}
     if(!ok)return redirect('/admin/?error=login');
     failures.delete(ip);const key=randomBytes(32).toString('hex');
     sessions.set(key,{salt:row.salt,until:Date.now()+8*3600000});
     return redirect('/admin/',{'Set-Cookie':cookie(key,8*3600)});
   }};
   const result=await handle(req,service);
   out.writeHead(result.status,Object.fromEntries(result.headers));
   out.end(method==='HEAD'?undefined:Buffer.from(await result.arrayBuffer()));
 }catch{if(!out.headersSent)out.writeHead(400);out.end()}
}).listen(port,host,()=>console.log('Showroom dinleniyor: '+host+':'+port));
