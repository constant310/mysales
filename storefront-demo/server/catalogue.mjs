import pg from 'pg';
const {Pool} = pg;
const pool=new Pool({connectionString:process.env.EARLY_STOREFRONT_DATABASE_URL,ssl:{rejectUnauthorized:true}});
export async function products(store){
 const {rows}=await pool.query(`select p.id,p.name,p.description,p.category,p.published,p.base_unit,
 coalesce(s.quantity_base,0) as stock,
 coalesce(json_agg(json_build_object('id',u.id,'name',u.name,'factor',u.factor,'price',u.price_ngn))
 filter(where u.id is not null),'[]'::json) as units
 from early_storefront.products p left join early_storefront.stock s on s.product_id=p.id and s.store_id=p.store_id
 left join early_storefront.units u on u.product_id=p.id and u.store_id=p.store_id
 where p.store_id=$1 group by p.id,s.quantity_base order by p.created_at desc`,[store]);
 return rows;
}
export async function addProduct(store,{name,description='',category='',baseUnit='piece',unitName='piece',factor=1,price}){
 if(typeof name!=='string'||!name.trim()||name.length>150||typeof description!=='string'||description.length>2000||typeof category!=='string'||category.length>80||typeof baseUnit!=='string'||!baseUnit.trim()||baseUnit.length>40||typeof unitName!=='string'||!unitName.trim()||unitName.length>40||!Number.isSafeInteger(Number(factor))||Number(factor)<1||Number(factor)>1000000||!Number.isSafeInteger(Number(price))||Number(price)<0)throw Error('Invalid product');
 const db=await pool.connect();
 try{
  await db.query('begin');
  const {rows}=await db.query('insert into early_storefront.products(store_id,name,description,category,base_unit) values($1,$2,$3,$4,$5) returning id',[store,name.trim(),description,category,baseUnit]);
  const id=rows[0].id;
  await db.query('insert into early_storefront.units(store_id,product_id,name,factor,price_ngn) values($1,$2,$3,$4,$5)',[store,id,unitName,Number(factor),Number(price)]);
  await db.query('insert into early_storefront.stock(store_id,product_id,quantity_base) values($1,$2,0)',[store,id]);
  await db.query('commit');
  return {id};
 }catch(e){await db.query('rollback');throw e;}finally{db.release();}
}
