import { validateCatalog } from './catalog.mjs';
import { readFile, writeFile, mkdir, cp, rename, rm, stat, mkdtemp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { layout, home, detail, filamentsPage, workshop } from './pages.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const data = JSON.parse(await readFile(path.join(root, 'data/catalog.json'), 'utf8'));
validateCatalog(data);
for (const product of data.products) {
  for (const image of product.images) await stat(path.join(root,'public/assets',image.src));
}
const temp = await mkdtemp(path.join(root,'.build-'));
try {
  await cp(path.join(root,'public'), temp, {recursive:true});
  const page = async (folder,title,active,body,description) => {
    const dir = path.join(temp,folder);
    await mkdir(dir,{recursive:true});
    await writeFile(path.join(dir,'index.html'),layout(title,active,body,description));
  };
  await page('','3D Baskı Vitrini','vitrin',home(data));
  await page('filamentler','Filamentler','filamentler',filamentsPage(data));
  await page('atolye','Atölye','atolye',workshop(data));
  for (const p of data.products) await page('urun/'+p.slug,p.name,'vitrin',detail(data,p),p.description);
  await rm(path.join(root,'dist'),{recursive:true,force:true});
  await rename(temp,path.join(root,'dist'));
} finally { await rm(temp,{recursive:true,force:true}); }
console.log(data.products.length+' ürün ve '+data.filaments.length+' filament doğrulandı. dist/ hazır.');
