import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
test('Render server has health endpoint and protected API route',async()=>{
 const src=await readFile(new URL('render-server.mjs',root),'utf8');
 assert.match(src,/\/health/);assert.match(src,/\/api\/merchant\/confirm-sale/);
});
test('WhatsApp enquiry does not directly modify inventory',async()=>{
 const src=await readFile(new URL('s/index.html',root),'utf8');
 assert.match(src,/wa\.me/);assert.doesNotMatch(src,/\/api\/merchant\/confirm-sale/);
});
test('Merchant export requires session',async()=>{
 const src=await readFile(new URL('api/merchant/export.mjs',root),'utf8');
 assert.match(src,/merchantFromRequest/);assert.match(src,/401/);
});

test('Discovery page is routed and API lists only published stores',async()=>{
 const server=await readFile(new URL('render-server.mjs',root),'utf8');
 const discover=await readFile(new URL('api/discover.mjs',root),'utf8');
 assert.match(server,/path==='\\/discover'/);
 assert.match(server,/\\/api\\/discover/);
 assert.match(discover,/s.status='published'/);
 assert.match(discover,/p.published=true/);
});
test('Static responses prohibit framing',async()=>{
 const server=await readFile(new URL('render-server.mjs',root),'utf8');
 assert.match(server,/frame-ancestors/);
 assert.match(server,/X-Frame-Options/);
});
