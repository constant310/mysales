/* Public storefront navigation is independent of merchant API authorization.
   Supabase JWT and store ownership are checked by the backend. */
import {accessToken} from '/auth/client.mjs';

export function ownerMatchesPublicStore(publicStore,identity){
 const mine=identity?.store;
 return identity?.authenticated===true
   && typeof publicStore?.public_handle==='string' && publicStore.public_handle.length>0
   && typeof publicStore?.slug==='string' && publicStore.slug.length>0
   && mine?.public_handle===publicStore.public_handle
   && mine?.slug===publicStore.slug;
}

// Fail closed for signed-out browsers, other stores and backend/network errors.
export async function canManagePublicStore(publicStore,getToken=accessToken,request=fetch){
 if(!publicStore?.public_handle||!publicStore?.slug)return false;
 try{
  const token=await getToken();
  if(!token)return false;
  const response=await request('/api/merchant/me',{
   method:'GET',headers:{Authorization:'Bearer '+token},cache:'no-store'
  });
  if(!response.ok)return false;
  return ownerMatchesPublicStore(publicStore,await response.json());
 }catch{return false;}
}
