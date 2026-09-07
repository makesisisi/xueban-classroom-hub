import fs from 'node:fs';
import crypto from 'node:crypto';
const path='.env';
if(!fs.existsSync(path)) fs.writeFileSync(path,`ADMIN_SETUP_SECRET=${crypto.randomBytes(24).toString('hex')}\n`);
