// Validate an Early Storefront export and convert it into an ERP-neutral
// migration bundle. Read-only: this script NEVER connects to or writes to mySales.
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function check(condition,message){if(!condition)throw new Error('Invalid storefront export: '+message);}
function positiveInteger(value,allowZero=true){return Number.isSafeInteger(Number(value))&&Number(value)>=(allowZero?0:1);}
function ensureUnique(rows,label){const ids=new Set();for(const x of rows){check(uuid.test(String(x.id||'')),label+' contains an invalid id');check(!ids.has(x.id),label+' contains duplicate id '+x.id);ids.add(x.id);}}
export function prepareMigrationBundle(exported,{branchName='Main Branch',targetBusinessId=null}={}){
 check(object(exported)&&exported.format==='mysales-early-storefront'&&exported.version===1,'unsupported format or version');
 const storeId=exported.storeId;
 check(typeof storeId==='string'&&uuid.test(storeId),'missing store id');
 check(object(exported.tables),'missing tables');
 const t=exported.tables;
 for(const n of ['stores','products','units','stock','sales','stock_movements'])check(Array.isArray(t[n]),'missing '+n+' array');
 check(t.stores.length===1&&t.stores[0].id===storeId,'store id mismatch');
 check(typeof t.stores[0].slug==='string'&&typeof t.stores[0].name==='string','invalid store details');
 check(typeof branchName==='string'&&branchName.trim().length>0&&branchName.length<=150,'invalid branch name');
 const scoped=['products','units','stock','sales','stock_movements'];
 for(const n of scoped)for(const row of t[n])check(row.store_id===storeId,n+' contains another tenant');
 ensureUnique(t.products,'products');ensureUnique(t.units,'units');ensureUnique(t.sales,'sales');ensureUnique(t.stock_movements,'stock_movements');
 const products=new Map(t.products.map(p=>[p.id,p]));
 const units=new Map(t.units.map(u=>[u.id,u]));
 const stocks=new Map();
 for(const st of t.stock){
  check(products.has(st.product_id),'stock references an unknown product');
  check(!stocks.has(st.product_id),'duplicate stock row');
  check(positiveInteger(st.quantity_base),'invalid stock quantity');
  stocks.set(st.product_id,Number(st.quantity_base));
 }
 for(const unit of t.units){
  check(products.has(unit.product_id),'unit references an unknown product');
  check(positiveInteger(unit.factor,false),'invalid selling unit factor');
  check(positiveInteger(unit.price_ngn),'invalid selling price');
 }
 for(const sale of t.sales){
  check(products.has(sale.product_id),'sale references an unknown product');
  check(units.has(sale.unit_id)&&units.get(sale.unit_id).product_id===sale.product_id,'sale references an unrelated unit');
  check(positiveInteger(sale.quantity,false)&&positiveInteger(sale.quantity_base,false),'invalid sale quantity');
  check(positiveInteger(sale.price_ngn),'invalid sale price');
 }
 for(const movement of t.stock_movements)check(products.has(movement.product_id),'movement references an unknown product');
 const catalogue=t.products.map(p=>({
  migrationKey:'early-storefront:product:'+p.id,
  sourceProductId:p.id,sourceStoreId:storeId,
  name:p.name,description:p.description||'',category:p.category||'',
  baseUnit:p.base_unit||'piece',imageUrl:p.image_path||null,
  published:!!p.published,archived:!!p.archived_at,
  quantityBase:stocks.get(p.id)||0,
  sellingUnits:t.units.filter(u=>u.product_id===p.id).map(u=>({
   migrationKey:'early-storefront:unit:'+u.id,sourceUnitId:u.id,
   name:u.name,factor:Number(u.factor),priceNgn:Number(u.price_ngn),active:!!u.active
  }))
 }));
 const sales=t.sales.map(s=>({
  migrationKey:'early-storefront:sale:'+s.id,
  sourceSaleId:s.id,sourceProductId:s.product_id,sourceUnitId:s.unit_id,
  quantity:Number(s.quantity),quantityBase:Number(s.quantity_base),
  priceNgn:Number(s.price_ngn),requestKey:s.request_key,createdAt:s.created_at
 }));
 const movements=t.stock_movements.map(m=>({
  migrationKey:'early-storefront:stock-movement:'+m.id,
  sourceMovementId:m.id,sourceProductId:m.product_id,
  deltaBase:Number(m.delta_base),reason:m.reason,createdAt:m.created_at
 }));
 const s=t.stores[0];
 return {
  format:'mysales-storefront-migration-bundle',version:1,
  dryRunOnly:true,
  source:{storeId,slug:s.slug,name:s.name,exportedAt:exported.exportedAt||null},
  proposedDestination:{businessId:targetBusinessId,branchName},
  business:{name:s.name,description:s.description||'',whatsapp:s.whatsapp||'',status:s.status},
  catalogue,sales,stockMovements:movements,
  summary:{products:catalogue.length,activeProducts:catalogue.filter(x=>!x.archived).length,
   units:t.units.length,stockRecords:stocks.size,sales:sales.length,movements:movements.length},
  note:'This bundle is NOT a completed mySales ERP import. A target-schema adapter and transaction-safe, idempotent import are required.'
 };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [input,flag,output]=process.argv.slice(2);
 if(!input||flag!=='--out'||!output){
  console.error('Usage: node scripts/prepare-migration.mjs <store-export.json> --out <migration-bundle.json>');
  process.exitCode=2;
 }else{
  try{
   const data=JSON.parse(await readFile(input,'utf8'));
   const bundle=prepareMigrationBundle(data);
   await writeFile(output,JSON.stringify(bundle,null,2)+'\n',{flag:'wx',mode:0o600});
   console.log(JSON.stringify({output,summary:bundle.summary,actualImportPerformed:false}));
  }catch(e){console.error(e.message);process.exitCode=1;}
 }
}
