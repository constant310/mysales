#!/usr/bin/env node
// Read-only production smoke test. No tokens or write requests are used.
// Usage: node storefront-demo/scripts/test-live.mjs
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';

const base=(process.env.STOREFRONT_BASE_URL||'https://mysales-early-storefront-branch.onrender.com').replace(/\/$/,'');
const slugs=['mysales-demo-grocery','mysales-demo-print-shop'];
const checks=[];
async function get(path){
 const began=performance.now();
 const response=await fetch(base+path,{signal:AbortSignal.timeout(16000)});
 const json=await response.json();
 const ms=+(performance.now()-began).toFixed(1);
 checks.push({path,status:response.status,ms});
 return {response,json};
}
try {
 const health=await get('/health/db');
 assert.equal(health.response.status,200);
 assert.equal(health.json.databaseConnected,true);
 const directory=await get('/api/discover');
 assert.equal(directory.response.status,200);
 assert.ok(Array.isArray(directory.json.stores));
 for(const slug of slugs){
  const result=await get('/api/store?slug='+encodeURIComponent(slug));
  assert.equal(result.response.status,200);
  assert.equal(result.json.store.slug,slug);
  assert.equal(result.json.products.length,10);
  assert.ok(directory.json.stores.some(x=>x.slug===slug));
  assert.match(result.response.headers.get('cache-control')||'',/max-age=6/);
 }
 const unauthenticated=await get('/api/merchant/products');
 assert.equal(unauthenticated.response.status,401);
 assert.match(unauthenticated.response.headers.get('cache-control')||'',/no-store/);
 console.log(JSON.stringify({passed:true,requests:checks.length,checks},null,2));
}catch(error){
 console.error(JSON.stringify({passed:false,error:error.message,checks},null,2));
 process.exitCode=1;
}
