const one = selector => document.querySelector(selector);
const all = selector => [...document.querySelectorAll(selector)];
const search = one('#search');
function normalized(value){
 return value.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/\p{M}/gu,'').replaceAll('ı','i').trim();
}
if (search) {
 const filters=all('[data-filter]'), cards=all('[data-category]');
 let category='';
 function apply(){
   const terms=normalized(search.value).split(/\s+/).filter(Boolean);
   for(const card of cards) {
     const text=normalized(card.dataset.search);
     card.hidden=Boolean(category && card.dataset.category!==category) || !terms.every(t=>text.includes(t));
   }
   const count=cards.filter(c=>!c.hidden).length;
   one('#result').textContent=count+' ürün';
   one('#empty').hidden=count!==0;
   for(const button of filters) button.setAttribute('aria-pressed',String(button.dataset.filter===category));
 }
 for(const button of filters) button.addEventListener('click',()=>{category=button.dataset.filter;apply()});
 search.addEventListener('input',apply);
 one('#clear').addEventListener('click',()=>{category='';search.value='';apply();search.focus()});
}
const mainPhoto=one('#mainphoto');
if(mainPhoto){
 const thumbs=all('[data-photo]'),colors=all('[data-message]'),dlg=one('#lightbox');
 function selectPhoto(b){
   mainPhoto.src=b.dataset.photo;mainPhoto.alt=b.dataset.alt;
   one('#photokind').textContent=b.dataset.kind;
   for(const t of thumbs)t.setAttribute('aria-pressed',String(t===b));
 }
 for(const b of thumbs)b.addEventListener('click',()=>selectPhoto(b));
 for(const b of colors)b.addEventListener('click',()=>{
   for(const other of colors)other.setAttribute('aria-pressed',String(other===b));
   one('#colorname').textContent=b.dataset.name;one('#message').value=b.dataset.message;one('#feedback').textContent='';
 });
 one('#copy').addEventListener('click',async()=>{
   const field=one('#message');
   try{await navigator.clipboard.writeText(field.value);one('#feedback').textContent='Mesaj kopyalandı. Instagram sohbetine yapıştırabilirsin.'}
   catch{field.focus();field.select();one('#feedback').textContent='Mesaj seçildi. Cihazının Kopyala komutunu kullanabilirsin.'}
 });
 one('#zoom').addEventListener('click',()=>{const image=dlg.querySelector('img');image.src=mainPhoto.src;image.alt=mainPhoto.alt;dlg.showModal()});
 one('#closezoom').addEventListener('click',()=>dlg.close());
 dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close()});
}
