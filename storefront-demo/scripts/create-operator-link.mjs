// Trusted operator terminal only. A private, reusable link is printed ONCE.
import {readFileSync} from 'node:fs';
import {setDefaultCACertificates,getCACertificates} from 'node:tls';
import {issueOperatorLink} from '../server/operator-access.mjs';
setDefaultCACertificates([...getCACertificates('default'),
 readFileSync(new URL('../certs/supabase-root-2021.crt',import.meta.url),'utf8')]);
const origin=process.argv[2];
if(!origin||!origin.startsWith('https://')){
 console.error('Usage: node storefront-demo/scripts/create-operator-link.mjs https://your-storefront.onrender.com');
 process.exit(1);
}
if(!process.env.EARLY_STOREFRONT_DATABASE_URL)throw Error('Set the private server DB URL first');
console.log(JSON.stringify(await issueOperatorLink(origin),null,2));
