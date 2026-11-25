import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { validateCatalog } from './catalog.mjs';
export const root=fileURLToPath(new URL('../',import.meta.url));
export const mime={css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',svg:'image/svg+xml',webp:'image/webp',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',ttf:'font/ttf',txt:'text/plain; charset=utf-8'};
export function openStore(){
  const dir=path.resolve(process.env.SHOWROOM_DATA_DIR||path.join(root,'var'));
  mkdirSync(dir,{recursive:true,mode:0o700});
  const db=new DatabaseSync(path.join(dir,'showroom.sqlite'));
  db.exec(`PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS catalog (id INTEGER PRIMARY KEY CHECK(id=1), revision TEXT NOT NULL, body TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS uploads (name TEXT PRIMARY KEY, bytes BLOB NOT NULL);
    CREATE TABLE IF NOT EXISTS admin (id INTEGER PRIMARY KEY CHECK(id=1), salt TEXT NOT NULL, digest TEXT NOT NULL);`);
  if(!db.prepare('SELECT 1 FROM catalog WHERE id=1').get()){
    const seed=JSON.parse(readFileSync(path.join(root,'data/catalog.json'),'utf8'));
    validateCatalog(seed);
    db.prepare('INSERT OR IGNORE INTO catalog VALUES(1,?,?)').run(randomUUID(),JSON.stringify(seed));
  }
  return db;
}
