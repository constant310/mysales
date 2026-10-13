import {readFileSync} from 'node:fs';
import {setDefaultCACertificates,getCACertificates} from 'node:tls';
import {revokeOperatorLink} from '../server/operator-access.mjs';
setDefaultCACertificates([...getCACertificates('default'),
 readFileSync(new URL('../certs/supabase-root-2021.crt',import.meta.url),'utf8')]);
await revokeOperatorLink(process.argv[2]||'');
console.log('Operator link and sessions revoked');
