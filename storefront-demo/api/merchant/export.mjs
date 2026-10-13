import {Pool} from 'pg';
import {merchantFromRequest} from '../../server/http-auth.mjs';
const pool=new Pool({connectionString:process.env.EARLY_STOREFRONT_DATABASE_URL,ssl:{rejectUnauthorized:true}});
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 try{
  const merchant=await merchantFromRequest(req);
  if(!merchant)return res.status(401).json({error:'Private access required'});
  const id=merchant.store_id;
  const db=await pool.connect();
  try{
   await db.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   const tables=['stores','products','units','stock','sales','sale_items','stock_movements'];
   const result={format:'mysales-early-storefront',version:1,exportedAt:new Date().toISOString(),storeId:id,tables:{}};
   for(const table of tables){
    const sql=table==='stores'?'select * from early_storefront.stores where id=$1':table==='sale_items'?'select si.* from early_storefront.sale_items si join early_storefront.sales s on s.id=si.sale_id where s.store_id=$1':`select * from early_storefront.${table} where store_id=$1`;
    result.tables[table]=(await db.query(sql,[id])).rows;
   }
   await db.query('COMMIT');
   res.setHeader('Content-Disposition','attachment; filename="mysales-storefront-export.json"');
   return res.status(200).json(result);
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 }catch(e){console.error('Export failed',e.message);return res.status(500).json({error:'Unable to export store'});}
}
