import pg from 'pg';
const {Pool} = pg;
const pool=new Pool({connectionString:process.env.EARLY_STOREFRONT_DATABASE_URL,ssl:{rejectUnauthorized:true}});
export default async function handler(req,res){
 res.setHeader('Cache-Control','public, max-age=30');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const slug=String(req.query.slug||'');
 if(!/^[a-z0-9-]{2,80}$/.test(slug))return res.status(400).json({error:'Invalid store'});
 try{
  const s=await pool.query("select id,slug,name,description,whatsapp from early_storefront.stores where slug=$1 and status='published' limit 1",[slug]);
  if(!s.rowCount)return res.status(404).json({error:'Store not found'});
  const store=s.rows[0];
  const p=await pool.query(`select p.id,p.name,p.description,p.category,p.image_path,p.base_unit,
   coalesce(st.quantity_base,0) as stock,
   coalesce(json_agg(json_build_object('name',u.name,'factor',u.factor,'price',u.price_ngn))
   filter(where u.id is not null),'[]'::json) as units
   from early_storefront.products p
   left join early_storefront.units u on u.product_id=p.id and u.store_id=p.store_id and u.active=true
   left join early_storefront.stock st on st.product_id=p.id and st.store_id=p.store_id
   where p.store_id=$1 and p.published=true
   group by p.id,st.quantity_base order by p.created_at desc`,[store.id]);
  delete store.id;
  return res.status(200).json({store,products:p.rows});
 }catch(e){console.error('Public store API failure',e.message);return res.status(500).json({error:'Store unavailable'});}
}
