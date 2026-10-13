// Offline, read-only validation and normalized handoff format for moving an
// Early Storefront into mySales. This never connects to, or alters, either DB.
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
function check(ok,message){if(!ok)throw new Error('Invalid storefront export: '+message);}
const integer=(value,{zero=true}={})=>{
 const n=typeof value==='number'?String(value):value;
 check(typeof n==='string'&&/^-?\d+$/.test(n),'invalid integer');
 const big=BigInt(n);
 check(big>=(zero?0n:1n),'negative or zero amount');
 return big;
};
const arr=(v,label)=>{check(Array.isArray(v),label+' must be an array');return v;};
const hasId=(v)=>typeof v==='string'&&UUID.test(v);
const uniqueMap=(items,label)=>{
 const m=new Map();
 for(const item of items){
  check(item&&typeof item==='object'&&hasId(item.id),label+' has invalid ID');
  check(!m.has(item.id),label+' has duplicate ID '+item.id);
  m.set(item.id,item);
 }
 return m;
};
export function prepareMigration(input){
 check(input&&typeof input==='object'&&!Array.isArray(input),'missing export');
 check(input.format==='mysales-early-storefront'&&input.version===1,'unsupported format or version');
 check(hasId(input.storeId),'invalid store ID');
 check(input.tables&&typeof input.tables==='object','missing tables');
 const t=input.tables;
 for(const key of ['stores','products','units','stock','sales','stock_movements'])arr(t[key],key);
 check(t.stores.length===1&&t.stores[0]?.id===input.storeId,'export must contain precisely its own store');
 const store=t.stores[0];
 check(typeof store.slug==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(store.slug),'invalid store slug');
 check(typeof store.name==='string'&&!!store.name.trim(),'missing store name');
 check(typeof store.whatsapp==='string','missing WhatsApp field');
 const products=uniqueMap(t.products,'products'),units=uniqueMap(t.units,'units');
 const stock=new Map(),saleIds=new Set(),keys=new Set(),movementIds=new Set();
 for(const p of products.values()){
  check(p.store_id===input.storeId,'foreign product belongs to a different store');
  check(typeof p.name==='string'&&!!p.name.trim(),'unnamed product');
  check(typeof p.base_unit==='string'&&!!p.base_unit,'missing product base unit');
  check(p.image_path==null||(typeof p.image_path==='string'&&/^https:\/\//.test(p.image_path)),'invalid product image URL');
 }
 for(const u of units.values()){
  check(u.store_id===input.storeId&&products.has(u.product_id),'unit refers to wrong store/product');
  integer(u.factor,{zero:false});integer(u.price_ngn);
  check(typeof u.name==='string'&&!!u.name.trim(),'unnamed selling unit');
 }
 for(const s of t.stock){
  check(s.store_id===input.storeId&&products.has(s.product_id),'stock refers to another store/product');
  check(!stock.has(s.product_id),'duplicate stock record');
  stock.set(s.product_id,integer(s.quantity_base).toString());
 }
 for(const p of products.values())check(stock.has(p.id),'missing stock for product '+p.id);
 for(const s of t.sales){
  check(hasId(s.id)&&!saleIds.has(s.id),'invalid or duplicate sale ID');
  saleIds.add(s.id);
  check(s.store_id===input.storeId&&products.has(s.product_id),'sale product belongs to another store');
  const unit=units.get(s.unit_id);
  check(!!unit&&unit.product_id===s.product_id,'sale unit belongs to a different product');
  check(hasId(s.request_key)&&!keys.has(s.request_key),'duplicate sale idempotency key');
  keys.add(s.request_key);
  integer(s.quantity,{zero:false});integer(s.quantity_base,{zero:false});integer(s.price_ngn);
  // Stock movements and historic sale records, not reconstructed prices,
  // remain the source of truth for historical transactions.
 }
 for(const m of t.stock_movements){
  check(hasId(m.id)&&!movementIds.has(m.id),'invalid or duplicate movement');
  movementIds.add(m.id);
  check(m.store_id===input.storeId&&products.has(m.product_id),'stock movement belongs to another store');
  check(typeof m.delta_base==='string'||typeof m.delta_base==='number','invalid stock delta');
  const delta=String(m.delta_base);
  check(/^-?\d+$/.test(delta),'invalid stock delta');
 }
 const items=[...products.values()].map(p=>({
  sourceProductId:p.id,name:p.name,description:p.description??'',category:p.category??'',
  baseUnit:p.base_unit,published:Boolean(p.published),archived:p.archived_at!=null,
  imageUrl:p.image_path??null,quantityBase:stock.get(p.id),
  sellingUnits:[...units.values()].filter(u=>u.product_id===p.id).map(u=>({
   sourceUnitId:u.id,name:u.name,factor:String(u.factor),priceNgn:String(u.price_ngn),
   active:u.active!==false
  }))
 }));
 return {
  format:'mysales-storefront-migration-manifest',version:1,
  source:{system:'mySales Early Storefront',storeId:input.storeId,exportedAt:input.exportedAt||null},
  destination:{organizationId:null,businessId:null,branchId:null,status:'mapping-required'},
  store:{slug:store.slug,name:store.name,description:store.description??'',whatsapp:store.whatsapp,status:store.status},
  products:items,sales:t.sales,stockMovements:t.stock_movements,
  summary:{
   products:items.length,activeProducts:items.filter(x=>!x.archived).length,
   archivedProducts:items.filter(x=>x.archived).length,
   sellingUnits:units.size,sales:saleIds.size,stockMovements:movementIds.size,
   totalStockBase:items.reduce((s,p)=>s+BigInt(p.quantityBase),0n).toString(),
  },
  note:'Dry-run handoff only. No write to main mySales. Target IDs and branch inventory mapping must be verified before import.'
 };
}
