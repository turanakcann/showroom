export class CatalogError extends Error {
  constructor(message, status = 422) { super(message); this.status = status; }
}
export function requireValue(condition, message, status) {
  if (!condition) throw new CatalogError(message, status);
}
export const imageName = name => typeof name === 'string' && /^[a-zA-Z0-9_-]{1,100}\.(webp|jpg|jpeg|png)$/i.test(name);
const identifier = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 100;
const color = value => typeof value === 'string' && /^#[a-f0-9]{6}$/i.test(value);
const word = (value, max = 180) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const unique = values => new Set(values).size === values.length;
export function validateCatalog(data) {
  requireValue(data && typeof data.demo === 'boolean' && Array.isArray(data.products) && Array.isArray(data.filaments), 'Katalog biçimi geçersiz.');
  requireValue(data.products.every(p => p && typeof p === 'object') && data.filaments.every(f => f && typeof f === 'object'), 'Kayıt biçimi geçersiz.');
  const ids = data.filaments.map(f => f.id);
  requireValue(unique(ids), 'Filament kimliği zaten kullanılıyor.');
  for (const f of data.filaments) requireValue(identifier(f.id) && word(f.name) && word(f.material) && color(f.hex) && typeof f.available === 'boolean', 'Filament adı, malzemesi veya rengi geçersiz.');
  requireValue(unique(data.products.map(p => p.slug)) && unique(data.products.map(p => p.code)), 'Ürün kodu ve adresi benzersiz olmalı.');
  for (const p of data.products) {
    requireValue(identifier(p.slug) && word(p.code) && word(p.name) && word(p.category) && word(p.description, 8000), 'Ürün adresi, kodu, adı, kategorisi ve açıklaması gerekli.');
    requireValue(['Model','Basılmış','Basılabilir'].includes(p.status), 'Baskı durumu geçersiz.');
    requireValue(Array.isArray(p.dimensionsMm) && p.dimensionsMm.length === 3 && p.dimensionsMm.every(v => Number.isFinite(v) && v > 0), 'Üç boyut da pozitif olmalı.');
    requireValue(p.priceTry === null || (Number.isFinite(p.priceTry) && p.priceTry >= 0), 'Fiyat sıfır veya pozitif olmalı.');
    requireValue(color(p.backdrop) && Array.isArray(p.tags) && p.tags.every(t => word(t)), 'Etiket veya arka plan değeri geçersiz.');
    requireValue(Array.isArray(p.filaments) && unique(p.filaments) && p.filaments.every(id => ids.includes(id)), 'Ürün silinmiş veya geçersiz bir filamente bağlı.');
    requireValue(Array.isArray(p.images) && p.images.length && p.images.every(i => i && imageName(i.src) && word(i.alt) && word(i.kind)), 'Bir kapak görseli ve her görsel için açıklama gerekli.');
  }
  requireValue(data.products.length ? data.products.some(p => p.slug === data.featured) : !data.featured, 'Öne çıkan ürün bulunamadı.');
}
