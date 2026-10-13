import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareMigrationBundle} from '../scripts/prepare-migration.mjs';
const storeId='11111111-1111-4111-8111-111111111111';
const a='22222222-2222-4222-8222-222222222222',b='33333333-3333-4333-8333-333333333333';
const ua='44444444-4444-4444-8444-444444444444',ub='55555555-5555-4555-8555-555555555555';
const saleId='66666666-6666-4666-8666-666666666666',movId='77777777-7777-4777-8777-777777777777';
function fixture(){return {
 format:'mysales-early-storefront',version:1,storeId,exportedAt:'2026-10-13T12:00:00Z',
 tables:{
  stores:[{id:storeId,slug:'demo-test',name:'DEMO store',whatsapp:'2340000000000',status:'published'}],
  products:[{id:a,store_id:storeId,name:'Rice',published:true,base_unit:'piece'},
            {id:b,store_id:storeId,name:'Archived test',published:false,archived_at:'2026-10-13T12:00:00Z'}],
  units:[{id:ua,store_id:storeId,product_id:a,name:'piece',factor:1,price_ngn:350},
         {id:ub,store_id:storeId,product_id:b,name:'box',factor:6,price_ngn:1200,active:false}],
  stock:[{store_id:storeId,product_id:a,quantity_base:9},{store_id:storeId,product_id:b,quantity_base:0}],
  sales:[{id:saleId,store_id:storeId,product_id:a,unit_id:ua,quantity:1,quantity_base:1,price_ngn:350,request_key:storeId}],
  stock_movements:[{id:movId,store_id:storeId,product_id:a,delta_base:-1,reason:'sale'}]
 }
};}
test('converts the existing export format to an ERP-neutral bundle with stable migration keys',()=>{
 const out=prepareMigrationBundle(fixture());
 assert.equal(out.format,'mysales-storefront-migration-bundle');
 assert.equal(out.dryRunOnly,true);
 assert.deepEqual(out.summary,{products:2,activeProducts:1,units:2,stockRecords:2,sales:1,movements:1});
 assert.equal(out.catalogue[0].quantityBase,9);
 assert.equal(out.catalogue[0].migrationKey,'early-storefront:product:'+a);
 assert.equal(out.sales[0].sourceSaleId,saleId);
 assert.equal(out.proposedDestination.branchName,'Main Branch');
});
test('preserves intended destination mapping without writing to the ERP',()=>{
 const out=prepareMigrationBundle(fixture(),{targetBusinessId:'pilot',branchName:'Warri Branch'});
 assert.equal(out.proposedDestination.businessId,'pilot');
 assert.equal(out.proposedDestination.branchName,'Warri Branch');
});
test('rejects rows belonging to another store',()=>{
 const x=fixture();x.tables.products[0].store_id=b;
 assert.throws(()=>prepareMigrationBundle(x),/another tenant/);
});
test('rejects duplicate product IDs',()=>{
 const x=fixture();x.tables.products[1].id=a;
 assert.throws(()=>prepareMigrationBundle(x),/duplicate id/);
});
test('rejects a sale with mismatched selling unit',()=>{
 const x=fixture();x.tables.sales[0].unit_id=ub;
 assert.throws(()=>prepareMigrationBundle(x),/unrelated unit/);
});
test('rejects incomplete exports',()=>{
 const x=fixture();delete x.tables.stock;
 assert.throws(()=>prepareMigrationBundle(x),/missing stock array/);
});