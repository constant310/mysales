import pg from 'pg';
const {Pool} = pg;
const pool=new Pool({connectionString:process.env.EARLY_STOREFRONT_DATABASE_URL,ssl:{rejectUnauthorized:true}});
export default async function handler(req,res){
 res.setHeader('Cache-Control','public, max-age=30');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const search=String(req.query.q||'').trim().slice(0,80);
 const term='%'+search.replace(/[\\%_]/g,'\\$&')+'%';
 try{
  const {rows}=await pool.query(`select s.slug,s.name,s.description,
  count(distinct p.id)::int as product_count,
  coalesce(json_agg(distinct p.category) filter(where p.category is not null and p.category<>''),'[]'::json) as categories
  from early_storefront.stores s
  join early_storefront.products p on p.store_id=s.id and p.published=true
  where s.status='published' and ($1='' or s.name ilike $2 or s.description ilike $2
    or exists(select 1 from early_storefront.products x where x.store_id=s.id and x.published=true and (x.name ilike $2 or x.category ilike $2)))
  group by s.id order by s.name asc limit 100`,[search,term]);
  return res.status(200).json({stores:rows,source:'live'});
 }catch(e){console.error('Discover failed',e.message);return res.status(500).json({error:'Unable to load businesses'});}
}
