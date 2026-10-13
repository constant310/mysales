import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const base = new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,base),'utf8');

test('Supabase Edge uses bounded connections and streaming request size checks',async()=>{
 const src=await read('supabase/functions/early-storefront-backend/index.ts');
 assert.match(src,/max:\s*2,\s*prepare:\s*false/);
 assert.match(src,/maxBytes\s*=\s*65536/);
 assert.match(src,/reader\.read\(\)/);
 assert.match(src,/reader\.cancel\(\)/);
 assert.match(src,/return out\(413/);
});
test('Public catalogue uses indexed, preaggregated units without stock duplication',async()=>{
 const src=await read('supabase/functions/early-storefront-backend/index.ts');
 assert.match(src,/left join lateral/);
 assert.match(src,/su\.product_id=p\.id and su\.store_id=p\.store_id and su\.active=true/);
 assert.match(src,/p\.archived_at is null/);
 assert.match(src,/p\.published=true/);
});
test('Render streams large exports with backpressure and does not cache merchant credentials',async()=>{
 const src=await read('render-server.mjs');
 assert.match(src,/await pipeline\(Readable\.fromWeb\(response\.body\),res\)/);
 assert.match(src,/res\.headersSent/);
 assert.match(src,/path==='\/api\/merchant\/export'\?25000:12000/);
 assert.match(src,/publicRead\?'public, max-age=6/);
 assert.match(src,/:'no-store'/);
});
test('Operator POST calls reject cross-site origins',async()=>{
 const edge=await read('supabase/functions/early-storefront-backend/index.ts');
 assert.match(edge,/pathname\.startsWith\('\/api\/operator\/'\)/);
 assert.match(edge,/request\.method!=='GET' && requestedOrigin && requestedOrigin!==origin/);
 assert.match(edge,/Private operator link required/);
});
test('Migration handoff stays read-only and preserves exact historic source keys',async()=>{
 const source=await read('server/migration-export.mjs');
 const bundle=await read('scripts/prepare-migration.mjs');
 assert.match(source,/idempotency key/);
 assert.match(source,/sourceProductId/);
 assert.match(bundle,/dryRunOnly:true/);
 assert.match(bundle,/proposedDestination:\{businessId:targetBusinessId,branchName\}/);
});
