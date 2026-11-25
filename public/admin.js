'use strict';
const panel = document.querySelector('#panel');
const notice = document.querySelector('#notice');
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone = value => JSON.parse(JSON.stringify(value));
let catalog, revision, section='products', editor=null, images=[], busy=false, dirty=false;
function inform(text='',bad=false){notice.textContent=text;notice.classList.toggle('bad',bad)}
async function api(path,options={}){
  const res=await fetch('/admin/api/'+path,options);
  if(res.status===401)throw Error('Oturum sona erdi. Yeni bir sekmede yönetici girişi yap, ardından tekrar kaydet.');
  const result=await res.json();
  if(!res.ok)throw Error(result.error || 'İşlem tamamlanamadı.');
  return result;
}
function title(text,actions=''){return '<div class="title"><h1>'+esc(text)+'</h1>'+actions+'</div>'}
function button(action,label,kind='plain',extra=''){return '<button type="button" class="'+kind+'" data-action="'+action+'" '+extra+'>'+label+'</button>'}
function field(label,name,value='',attrs=''){return '<label>'+esc(label)+'<input name="'+name+'" value="'+esc(value)+'" '+attrs+'></label>'}
function selectField(label,name,values,current){return '<label>'+esc(label)+'<select name="'+name+'">'+values.map(v=>'<option '+(v===current?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select></label>'}
function inputValue(form,name){return String(new FormData(form).get(name)??'').trim()}
function activeTab(){
 for(const id of ['products','filaments']){
   const b=document.getElementById(id+'-tab');
   if(id===section)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
 }
}
function list(){
 editor=null;dirty=false;activeTab();
 const products=section==='products';
 panel.innerHTML=title(products?'Ürünler':'Filamentler',button('new',products?'+ Ürün ekle':'+ Filament ekle','primary'))+
 '<div class="tools"><input type="search" id="filter" aria-label="Listede ara" placeholder="'+(products?'Ürün adı veya kodu ara':'Renk veya malzeme ara')+'"><span class="count" id="count"></span></div><div id="rows" class="list"></div>'+
 (products?'<label class="check settings"><input type="checkbox" id="demo" '+(catalog.demo?'checked':'')+'>Vitrinde örnek katalog uyarısını göster</label>':'');
 panel.querySelector('#filter').addEventListener('input',rows);rows();
}
function rows(){
 const products=section==='products',needle=panel.querySelector('#filter').value.toLocaleLowerCase('tr-TR');
 const items=catalog[section].filter(p=>[p.name,products?p.code:p.material].join(' ').toLocaleLowerCase('tr-TR').includes(needle));
 panel.querySelector('#count').textContent=items.length+(products?' ürün':' filament');
 panel.querySelector('#rows').innerHTML=items.map(p=>{
   const image=products?'<img class="photo" src="/assets/'+esc(p.images[0].src)+'" alt="">':'<i class="chip" style="--back:'+esc(p.hex)+'"></i>';
   const meta=products?[p.code,p.category,p.status].join(' · '):p.material+' · '+(p.available?'Mevcut':'Tükendi');
   return '<div class="row"><div class="row-main">'+image+'<div><div class="name">'+esc(p.name)+'</div><div class="meta">'+esc(meta)+'</div></div></div>'+button('edit','Düzenle','mini','data-id="'+esc(products?p.slug:p.id)+'" aria-label="'+esc(p.name+' düzenle')+'"')+'</div>';
 }).join('') || '<p class="empty">Kayıt bulunamadı.</p>';
}
function edit(id=null){
 const product=section==='products',key=product?'slug':'id',item=catalog[section].find(x=>x[key]===id);
 editor={id};dirty=false;inform('');
 const p=item || (product?{code:'',name:'',category:'',slug:'',description:'',priceTry:null,status:'Model',dimensionsMm:['','',''],filaments:[],tags:[],images:[],backdrop:'#E7DECC'}:{name:'',id:'',hex:'#E75930',material:'PLA',available:true});
 const name=product?'Ürün':'Filament';
 const fields=product?productFields(p):filamentFields(p);
 panel.innerHTML=button('back','Listeye dön','back')+title(item?p.name:name+' ekle')+'<form id="editor">'+fields+'<div class="editfoot">'+
 (item?button('delete',name+' sil','danger'):'')+'<div class="edit-actions">'+button('back','Vazgeç')+'<button class="primary" type="submit">Kaydet</button></div></div></form>';
 if(product){images=clone(p.images);drawGallery()}
 window.scrollTo(0,0);
}
function productFields(p){
 const checks=catalog.filaments.map(f=>'<label class="check"><input type="checkbox" name="filaments" value="'+esc(f.id)+'" '+(p.filaments.includes(f.id)?'checked':'')+'><i class="dot" style="--back:'+esc(f.hex)+'"></i>'+esc(f.name+' · '+f.material+(f.available?'':' · Tükendi'))+'</label>').join('');
 return '<div class="columns"><div><section class="section"><h2>Ürün bilgileri</h2><div class="fields">'+field('Başlık','name',p.name,'required maxlength="180"')+field('Ürün kodu','code',p.code,'required maxlength="180"')+
 field('Ürün adresi','slug',p.slug,'placeholder="ornek-urun" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxlength="100"')+
 field('Kategori','category',p.category,'required list="categories"')+'<datalist id="categories">'+[...new Set(catalog.products.map(i=>i.category))].map(c=>'<option value="'+esc(c)+'">').join('')+'</datalist>'+
 '<label class="full">Açıklama<textarea rows="4" name="description" maxlength="8000" required>'+esc(p.description)+'</textarea></label></div></section>'+
 '<section class="section"><h2>Görseller</h2><p class="help">İlk görsel kapaktır. JPG, PNG veya WebP, dosya başına en fazla 5 MB.</p><div id="gallery"></div><label>Görsel yükle<input id="upload" type="file" multiple accept="image/jpeg,image/png,image/webp"></label></section></div>'+
 '<div><section class="section"><h2>Baskı ve fiyat</h2>'+selectField('Baskı durumu','status',['Model','Basılabilir','Basılmış'],p.status)+field('Fiyat (₺) · boşsa fiyat sorulur','price',p.priceTry,'type="number" step=".01" min="0"')+
 '<p>Boyutlar (mm)</p><div class="triple">'+['En','Derinlik','Yükseklik'].map((s,i)=>field(s,'dim'+i,p.dimensionsMm[i],'required type="number" min="0.001" step="any"')).join('')+'</div></section>'+
 '<section class="section"><h2>Filament seçenekleri</h2><div class="choices">'+(checks||'<p class="help">Filamentler bölümünden renk ekleyebilirsin.</p>')+'</div></section>'+
 '<section class="section"><h2>Vitrin</h2>'+field('Etiketler (virgülle ayır)','tags',p.tags.join(', '))+field('Görsel arka planı','backdrop',p.backdrop,'type="color"')+
 '<label class="check"><input name="featured" type="checkbox" '+(catalog.featured===p.slug&&p.slug?'checked':'')+'>Öne çıkan ürün</label></section></div></div>';
}
function filamentFields(p){
 return '<section class="section"><div class="fields">'+field('Renk adı','name',p.name,'required')+field('Malzeme','material',p.material,'required')+field('Renk','hex',p.hex,'type="color"')+
 field('Filament kimliği','id',p.id,(editor.id?'readonly ':'')+'placeholder="ornek-renk" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxlength="100"')+
 '</div><label class="check settings"><input type="checkbox" name="available" '+(p.available?'checked':'')+'>Stokta mevcut</label></section>';
}
function drawGallery(){
 panel.querySelector('#gallery').innerHTML=images.map((im,i)=>'<div class="pic" data-index="'+i+'"><img class="photo" src="/assets/'+esc(im.src)+'" alt=""><div class="info"><span class="badge">'+(i===0?'Kapak görseli':'Görsel '+(i+1))+'</span>'+
 field('Görsel açıklaması','alt',im.alt,'required maxlength="180"')+field('Görsel türü','kind',im.kind,'required list="image-kinds"')+
 '<div class="actions">'+(i>0?button('up','Öne al','mini'):'')+(i<images.length-1?button('down','Geri al','mini'):'')+button('remove-image','Kaldır','mini')+'</div></div></div>').join('')+
 '<datalist id="image-kinds"><option value="Baskı fotoğrafı"><option value="Model görseli"></datalist>';
}
function slugify(value){return value.toLocaleLowerCase('tr-TR').replaceAll('ı','i').normalize('NFD').replace(/\p{M}/gu,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100).replace(/-$/,'')}
function updateDraft(form){
 const next=clone(catalog), product=section==='products',key=product?'slug':'id',v=n=>inputValue(form,n);
 let row;
 if(product){
   if(!images.length)throw Error('En az bir ürün görseli ekle.');
   row={slug:v('slug')||slugify(v('name')),code:v('code'),name:v('name'),category:v('category'),description:v('description'),status:v('status'),priceTry:v('price')===''?null:Number(v('price')),dimensionsMm:[0,1,2].map(i=>Number(v('dim'+i))),filaments:new FormData(form).getAll('filaments'),tags:v('tags').split(',').map(s=>s.trim()).filter(Boolean),backdrop:v('backdrop'),images:clone(images)};
   if(form.elements.featured.checked || !next.products.length)next.featured=row.slug;
   else if(next.featured===editor.id)next.featured=next.products.find(p=>p.slug!==editor.id)?.slug || row.slug;
 }else row={id:v('id')||slugify(v('material')+'-'+v('name')),name:v('name'),material:v('material'),hex:v('hex'),available:form.elements.available.checked};
 const idx=next[section].findIndex(x=>x[key]===editor.id);
 if(idx<0)next[section].push(row);else next[section][idx]=row;
 return next;
}
async function commit(next){
 const result=await api('catalog',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,catalog:next})});
 catalog=next;revision=result.revision;list();inform('Değişiklikler vitrinde yayında.');
}
async function action(fn){
 if(busy)return;busy=true;panel.inert=true;inform('');
 try{await fn()}catch(e){inform(e.message,true)}finally{busy=false;panel.inert=false}
}
function leave(){return !dirty || confirm('Kaydedilmemiş değişikliklerden vazgeçilsin mi?')}
for(const tab of ['products','filaments'])document.getElementById(tab+'-tab').onclick=()=>{
 if(!catalog||busy||!leave())return;section=tab;list();inform('');
};
panel.addEventListener('submit',e=>{e.preventDefault();const form=e.target;action(()=>commit(updateDraft(form)))});
panel.addEventListener('input',e=>{
 if(!editor)return;dirty=true;
 const pic=e.target.closest('.pic');
 if(pic && ['kind','alt'].includes(e.target.name))images[Number(pic.dataset.index)][e.target.name]=e.target.value;
});
panel.addEventListener('change',e=>{
 if(e.target.id==='demo'){
   const next=clone(catalog);next.demo=e.target.checked;
   e.target.checked=catalog.demo;action(()=>commit(next));
 }
 if(e.target.id==='upload'){
   const files=[...e.target.files];e.target.value='';
   action(async()=>{
     for(const file of files){
       if(file.size>5*1024*1024)throw Error(file.name+' 5 MB sınırını aşıyor.');
       const {src}=await api('images',{method:'POST',body:file});
       images.push({src,alt:panel.querySelector('[name="name"]').value.trim()||file.name,kind:'Baskı fotoğrafı'});
       dirty=true;drawGallery();
     }
   });
 }
});
panel.addEventListener('click',e=>{
 const b=e.target.closest('[data-action]');if(!b||busy)return;
 const a=b.dataset.action;
 if(a==='new'||a==='edit')return edit(b.dataset.id||null);
 if(a==='back'&&leave()){list();inform();return}
 if(a==='delete'){
   const key=section==='products'?'slug':'id';
   const selected=catalog[section].find(x=>x[key]===editor.id);
   if(section==='filaments'&&catalog.products.some(p=>p.filaments.includes(editor.id))){inform('Bu filament ürünlerde kullanılıyor. Önce ürünlerden kaldır veya stok durumunu kapat.',true);return}
   if(!confirm('“'+selected.name+'” silinsin mi?'))return;
   const next=clone(catalog);next[section]=next[section].filter(x=>x[key]!==editor.id);
   if(section==='products'&&next.featured===editor.id)next.featured=next.products[0]?.slug||'';
   action(()=>commit(next));return;
 }
 const pic=b.closest('.pic');if(!pic)return;
 const i=Number(pic.dataset.index);
 if(a==='remove-image')images.splice(i,1);
 else {const j=a==='up'?i-1:i+1;[images[i],images[j]]=[images[j],images[i]]}
 dirty=true;drawGallery();
});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
action(async()=>{const result=await api('catalog');catalog=result.catalog;revision=result.revision;panel.removeAttribute('aria-busy');list()});
