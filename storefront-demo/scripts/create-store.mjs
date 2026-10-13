// Trusted operator CLI only. Never expose this action as a public HTTP endpoint.
import {Pool} from 'pg';
import {issueManagementLink} from '../server/management-links.mjs';
const [slug,name,whatsapp,origin]=process.argv.slice(2);
if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug||'')||!name||name.length>150||!/^[0-9+]{9,17}$/.test(whatsapp||'')||!origin?.startsWith('https://')){
 console.error('Usage: node scripts/create-store.mjs <slug> <name> <whatsapp> <https-origin>');process.exit(1);
}
if(!process.env.EARLY_STOREFRONT_DATABASE_URL)throw Error('Missing database connection');
const pool=new Pool({connectionString:process.env.EARLY_STOREFRONT_DATABASE_URL,ssl:{rejectUnauthorized:true}});
try{
 const {rows}=await pool.query("insert into early_storefront.stores(slug,name,whatsapp,status) values($1,$2,$3,'published') returning id",[slug,name,whatsapp]);
 const link=await issueManagementLink(rows[0].id,origin);
 console.log(JSON.stringify({storeId:rows[0].id,publicUrl:origin+'/s/?slug='+slug,managementLink:link},null,2));
 console.error('Management link is secret: deliver privately and never commit it.');
}finally{await pool.end();}
