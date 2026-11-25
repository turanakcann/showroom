import { randomBytes, scryptSync } from 'node:crypto';
import { openStore } from './local-store.mjs';
const db=openStore();
const password=randomBytes(24).toString('base64url');
const salt=randomBytes(16).toString('hex');
const digest=scryptSync(password,salt,64).toString('hex');
db.prepare('INSERT OR REPLACE INTO admin VALUES (1,?,?)').run(salt,digest);
db.close();
console.log('Kullanıcı: admin\nYeni parola: '+password+'\nBu parolayı parola yöneticine kaydet. Önceki oturumlar kapatıldı.');
