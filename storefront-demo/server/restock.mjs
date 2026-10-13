import pg from 'pg';
const {Pool} = pg;
const pool=new Pool({connectionString:process.env.EARLY_STOREFRONT_DATABASE_URL,ssl:{rejectUnauthorized:true}});
export async function restock(store,product,amount){
 if(!/^[0-9a-f-]{36}$/i.test(product)||!Number.isSafeInteger(Number(amount))||Number(amount)<1||Number(amount)>10000000)throw Error('Invalid stock');
 const db=await pool.connect();
 try{
  await db.query('begin');
  const r=await db.query('update early_storefront.stock set quantity_base=quantity_base+$3 where store_id=$1 and product_id=$2 returning quantity_base',[store,product,Number(amount)]);
  if(!r.rowCount)throw Error('Product not found');
  await db.query("insert into early_storefront.stock_movements(store_id,product_id,delta_base,reason) values($1,$2,$3,'restock')",[store,product,Number(amount)]);
  await db.query('commit');
  return {stock:r.rows[0].quantity_base};
 }catch(e){await db.query('rollback');throw e;}finally{db.release();}
}
