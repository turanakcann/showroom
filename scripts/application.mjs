import { layout, home, detail, filamentsPage, workshop } from './pages.mjs';
import { CatalogError, imageName, validateCatalog, requireValue } from './catalog.mjs';

export const response = (body, status=200, type='text/html; charset=utf-8', extra={}) => new Response(body,{status,headers:{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin',...extra}});
export const json = (value,status=200) => response(JSON.stringify(value),status,'application/json; charset=utf-8');
export async function limitedBytes(request, limit) {
  requireValue(Number(request.headers.get('Content-Length') || 0) <= limit,'Dosya veya istek çok büyük.',413);
  const reader=request.body?.getReader();
  if(!reader) return new Uint8Array();
  const parts=[]; let length=0;
  while(true){
    const item=await reader.read(); if(item.done)break;
    length+=item.value.length;
    if(length>limit){ await reader.cancel();throw new CatalogError('Dosya veya istek çok büyük.',413); }
    parts.push(item.value);
  }
  const bytes=new Uint8Array(length);let offset=0;
  for(const part of parts){bytes.set(part,offset);offset+=part.length}
  return bytes;
}
export async function payload(request,limit) {
  try{return JSON.parse(new TextDecoder().decode(await limitedBytes(request,limit)))}
  catch(e){if(e instanceof CatalogError)throw e; throw new CatalogError('JSON okunamadı.',400)}
}
function imageType(bytes){
  const ascii=(start,end)=>String.fromCharCode(...bytes.subarray(start,end));
  if(bytes[0]===255 && bytes[1]===216 && bytes[2]===255)return 'jpg';
  if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'png';
  if(ascii(0,4)==='RIFF' && ascii(8,12)==='WEBP')return 'webp';
  throw new CatalogError('JPG, PNG veya WebP görseli seç.');
}
const hex = buffer => Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,'0')).join('');
export async function handle(request,service){
  try{
    const {pathname,origin}=new URL(request.url);
    const route=pathname.replace(/\/$/,'') || '/';
    const write=!['GET','HEAD'].includes(request.method);
    if(write)requireValue(request.headers.get('Origin')===origin,'İstek kaynağı doğrulanamadı.',403);
    if(route==='/admin' || route.startsWith('/admin/')){
      if (route==='/admin/login' && request.method==='POST' && service.login) return await service.login(request);
      const authorized=await service.authorized(request);
      if(!authorized){
        if(route==='/admin' && !write)return await service.loginPage();
        return json({error:'Yönetici girişi gerekli.'},401);
      }
      if(route==='/admin' && !write)return await service.adminPage();
      if(route==='/admin/logout' && request.method==='POST')return await service.logout(request);
      if(route==='/admin/api/catalog'){
        if(request.method==='GET')return json(await service.read());
        if(request.method==='PUT'){
          const {catalog,revision}=await payload(request,1024*1024);
          requireValue(typeof revision==='string','Katalog sürümü eksik.',400);
          validateCatalog(catalog);
          const names=new Set(catalog.products.flatMap(p=>p.images.map(i=>i.src)));
          for(const name of names)requireValue(await service.hasImage(name),'Görsel bulunamadı: '+name);
          const next=await service.save(catalog,revision);
          requireValue(next,'Başka bir sekmede değişiklik yapıldı. Sayfayı yenileyip değişikliğini tekrar uygula.',409);
          return json({revision:next});
        }
      }
      if(route==='/admin/api/images' && request.method==='POST'){
        const bytes=await limitedBytes(request,5*1024*1024);
        const ext=imageType(bytes), src='img-'+hex(await crypto.subtle.digest('SHA-256',bytes))+'.'+ext;
        await service.putImage(src,bytes);
        return json({src},201);
      }
      return json({error:'İşlem bulunamadı.'},404);
    }
    if(write)return json({error:'Bu yöntem desteklenmiyor.'},405);
    const asset=await service.asset(pathname);
    if(asset)return asset;
    if(pathname.startsWith('/assets/')){
      const name=pathname.slice(8);
      if(imageName(name)){const upload=await service.getImage(name);if(upload)return upload;}
      return response('Görsel bulunamadı.',404,'text/plain; charset=utf-8');
    }
    const db=(await service.read()).catalog;
    if(route==='/')return response(layout('3D Baskı Vitrini','vitrin',home(db)));
    if(route==='/filamentler')return response(layout('Filamentler','filamentler',filamentsPage(db)));
    if(route==='/atolye')return response(layout('Atölye','atolye',workshop(db)));
    const product=db.products.find(p=>route==='/urun/'+p.slug);
    if(product)return response(layout(product.name,'vitrin',detail(db,product),product.description));
    return response('Sayfa bulunamadı.',404,'text/plain; charset=utf-8');
  }catch(e){
    if(e instanceof CatalogError)return json({error:e.message},e.status);
    console.error('Showroom işlem hatası:', e.name);
    return json({error:'İşlem tamamlanamadı. Tekrar deneyebilirsin.'},500);
  }
}
