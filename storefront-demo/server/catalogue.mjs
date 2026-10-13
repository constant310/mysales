import pg from 'pg';
const {Pool}=pg;
const pool=new Pool({connectionString:process.env.EARLY_STOREFRONT_DATABASE_URL,ssl:{rejectUnauthorized:true},max:5});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const goodText=(v,max,allowEmpty=false)=>typeof v==='string'&&v.length<=max&&(allowEmpty||!!v.trim());
const money=v=>Number.isSafeInteger(Number(v))&&Number(v)>=0&&Number(v)<=1000000000000;
const imageUrl=value=>{
 if(value===null||value===undefined||value==='')return null;
 if(typeof value!=='string'||value.length>1000)throw Error('Invalid product');
 try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.hostname==='localhost'||!u.hostname.includes('.'))throw Error('Invalid URL');return u.href;}
 catch{throw Error('Invalid product');}
};
export async function products(store){
 const {rows}=await pool.query(`SELECT p.id,p.name,p.description,p.category,p.published,p.base_unit,p.image_path,
  EXISTS(SELECT 1 FROM early_storefront.product_images im WHERE im.store_id=p.store_id AND im.product_id=p.id) AS has_image,
  COALESCE(s.quantity_base,0) AS stock,
  COALESCE(json_agg(json_build_object('id',u.id,'name',u.name,'factor',u.factor,'price',u.price_ngn,'active',u.active)
   ORDER BY u.created_at) FILTER(WHERE u.id IS NOT NULL),'[]'::json) AS units
  FROM early_storefront.products p
  LEFT JOIN early_storefront.stock s ON s.product_id=p.id AND s.store_id=p.store_id
  LEFT JOIN early_storefront.units u ON u.product_id=p.id AND u.store_id=p.store_id
  WHERE p.store_id=$1 AND p.archived_at IS NULL
  GROUP BY p.id,s.quantity_base ORDER BY p.created_at DESC`,[store]);
 return rows;
}
export async function addProduct(store,{name,description='',category='',baseUnit='piece',unitName='piece',factor=1,price,imageUrl:rawImageUrl=null}){
 if(!goodText(name,150)||!goodText(description,2000,true)||!goodText(category,80,true)||
  !goodText(baseUnit,40)||!goodText(unitName,40)||
  !Number.isSafeInteger(Number(factor))||Number(factor)<1||Number(factor)>1000000||!money(price))throw Error('Invalid product');
 const img=imageUrl(rawImageUrl);
 const db=await pool.connect();
 try{
  await db.query('BEGIN');
  const {rows}=await db.query(`INSERT INTO early_storefront.products(store_id,name,description,category,base_unit,image_path,published)
   VALUES($1,$2,$3,$4,$5,$6,false) RETURNING id`,[store,name.trim(),description.trim(),category.trim(),baseUnit.trim(),img]);
  const id=rows[0].id;
  await db.query('INSERT INTO early_storefront.units(store_id,product_id,name,factor,price_ngn) VALUES($1,$2,$3,$4,$5)',
   [store,id,unitName.trim(),Number(factor),Number(price)]);
  await db.query('INSERT INTO early_storefront.stock(store_id,product_id,quantity_base) VALUES($1,$2,0)',[store,id]);
  await db.query('COMMIT');
  return {id};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
export async function updateProduct(store,body){
 const {productId,name,description='',category='',imageUrl:rawImageUrl=null,unitId,price}=body||{};
 if(!uuid.test(productId||'')||!goodText(name,150)||!goodText(description,2000,true)||!goodText(category,80,true)||
    (unitId!==undefined&&!uuid.test(unitId||''))||(unitId!==undefined&&!money(price)))throw Error('Invalid product');
 const img=imageUrl(rawImageUrl);
 const db=await pool.connect();
 try{
  await db.query('BEGIN');
  const result=await db.query(`UPDATE early_storefront.products SET name=$3,description=$4,category=$5,image_path=$6
   WHERE store_id=$1 AND id=$2 AND archived_at IS NULL RETURNING id`,
   [store,productId,name.trim(),description.trim(),category.trim(),img]);
  if(!result.rowCount)throw Error('Product not found');
  if(unitId!==undefined){
   const unit=await db.query(`UPDATE early_storefront.units SET price_ngn=$4
    WHERE store_id=$1 AND product_id=$2 AND id=$3 RETURNING id`,[store,productId,unitId,Number(price)]);
   if(!unit.rowCount)throw Error('Selling unit not found');
  }
  await db.query('COMMIT');return {id:productId,updated:true};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
export async function archiveProduct(store,productId){
 if(!uuid.test(productId||''))throw Error('Invalid product');
 const {rows}=await pool.query(`UPDATE early_storefront.products SET archived_at=now(),published=false
  WHERE store_id=$1 AND id=$2 AND archived_at IS NULL RETURNING id`,[store,productId]);
 if(!rows.length)throw Error('Product not found');
 return {id:productId,archived:true};
}
export async function addSellingUnit(store,{productId,name,factor,price}){
 if(!uuid.test(productId||'')||!goodText(name,40)||
    !Number.isSafeInteger(Number(factor))||Number(factor)<1||Number(factor)>1000000||!money(price))throw Error('Invalid selling unit');
 const db=await pool.connect();
 try{
  await db.query('BEGIN');
  const found=await db.query(`SELECT 1 FROM early_storefront.products
   WHERE store_id=$1 AND id=$2 AND archived_at IS NULL FOR UPDATE`,[store,productId]);
  if(!found.rowCount)throw Error('Product not found');
  const count=await db.query('SELECT count(*)::int AS c FROM early_storefront.units WHERE store_id=$1 AND product_id=$2',[store,productId]);
  if(count.rows[0].c>=12)throw Error('Maximum 12 selling units per product');
  const {rows}=await db.query(`INSERT INTO early_storefront.units(store_id,product_id,name,factor,price_ngn)
    VALUES($1,$2,$3,$4,$5) RETURNING id`,[store,productId,name.trim(),Number(factor),Number(price)]);
  await db.query('COMMIT');return {id:rows[0].id};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
