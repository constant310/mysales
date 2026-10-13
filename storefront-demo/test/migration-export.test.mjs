import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareMigration} from '../server/migration-export.mjs';
const STORE='10000000-0000-4000-8000-000000000001';
const PRODUCT='20000000-0000-4000-8000-000000000001';
const UNIT='30000000-0000-4000-8000-000000000001';
const SALE='40000000-0000-4000-8000-000000000001';
const KEY='50000000-0000-4000-8000-000000000001';
const MOVE='60000000-0000-4000-8000-000000000001';
const sample=()=>({
 format:'mysales-early-storefront',version:1,storeId:STORE,exportedAt:'2026-10-13T00:00:00Z',
 tables:{
 stores:[{id:STORE,slug:'merchant-demo',name:'Merchant Demo',description:'',whatsapp:'2340000000000',status:'published'}],
 products:[{id:PRODUCT,store_id:STORE,name:'Sample soap',description:'',category:'Care',base_unit:'bar',published:true,image_path:null,archived_at:null}],
 units:[{id:UNIT,store_id:STORE,product_id:PRODUCT,name:'pack',factor:'6',price_ngn:'2700',active:true}],
 stock:[{store_id:STORE,product_id:PRODUCT,quantity_base:'18'}],
 sales:[{id:SALE,store_id:STORE,product_id:PRODUCT,unit_id:UNIT,quantity:'2',quantity_base:'12',price_ngn:'2700',request_key:KEY}],
 stock_movements:[{id:MOVE,store_id:STORE,product_id:PRODUCT,delta_base:'-12',reason:'sale'}]
 }});
test('migration handoff validates stock, units and historical sales without changing databases',()=>{
 const manifest=prepareMigration(sample());
 assert.equal(manifest.destination.status,'mapping-required');
 assert.deepEqual(manifest.summary,{products:1,activeProducts:1,archivedProducts:0,sellingUnits:1,sales:1,stockMovements:1,totalStockBase:'18'});
 assert.equal(manifest.products[0].sellingUnits[0].factor,'6');
 assert.equal(manifest.products[0].sellingUnits[0].priceNgn,'2700');
 assert.equal(manifest.products[0].sourceProductId,PRODUCT);
});
test('migration rejects another business mixing its product into the export',()=>{
 const doc=sample();doc.tables.products[0].store_id='10000000-0000-4000-8000-000000000002';
 assert.throws(()=>prepareMigration(doc),/different store/);
});
test('migration rejects a sale attached to a nonexistent selling unit',()=>{
 const doc=sample();doc.tables.sales[0].unit_id='30000000-0000-4000-8000-000000000002';
 assert.throws(()=>prepareMigration(doc),/different product/);
});
test('migration retains archived products and lossless stock precision',()=>{
 const doc=sample();doc.tables.products[0].archived_at='2026-10-13T00:00:00Z';
 doc.tables.stock[0].quantity_base='9007199254740993';
 const manifest=prepareMigration(doc);
 assert.equal(manifest.products[0].archived,true);
 assert.equal(manifest.summary.activeProducts,0);
 assert.equal(manifest.summary.totalStockBase,'9007199254740993');
});
