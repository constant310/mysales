/* mySales store-owner migration helpers.
   Never infer store ownership from public store names, telephone numbers, or email.
   Legacy capability may only be used after the merchant explicitly chooses to link
   a store; server validates ownership and revokes it atomically on success. */
export const LEGACY_TOKEN_KEY='mysales_private_management_token';
export const CLAIM_PROOF_KEY='mysales_legacy_claim_proof';
export const validPrivateToken=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);

export function parseLegacyProof(value) {
 const str=String(value||'').trim();
 if(validPrivateToken(str))return str;
 try {
  const link=new URL(str);
  if(link.protocol!=='https:'||![
   'store.mysalesofficial.com',
   'mysales-early-storefront-branch.onrender.com'
  ].includes(link.hostname))return '';
  const token=new URLSearchParams(link.hash.slice(1)).get('token')||'';
  return validPrivateToken(token)?token:'';
 }catch{return '';}
}

export function readLegacyProof(sessions,local) {
 try{const proof=sessions?.getItem(CLAIM_PROOF_KEY);if(validPrivateToken(proof))return proof;}catch{}
 try{const old=local?.getItem(LEGACY_TOKEN_KEY);if(validPrivateToken(old))return old;}catch{}
 return '';
}

export function saveClaimIntent(sessions,token) {
 if(!validPrivateToken(token))return false;
 try{sessions.setItem(CLAIM_PROOF_KEY,token);return true;}catch{return false;}
}
export function clearClaimIntent(sessions) {
 try{sessions.removeItem(CLAIM_PROOF_KEY);}catch{}
}

/* An explicit legacy #token always wins. Otherwise use a verified account's
   dashboard before stale local legacy tokens, and fall back to the old manager
   only when the user has no account session. */
export function managerEntry({hash='',accountSignedIn=false,legacyToken=''}={}) {
 if(validPrivateToken(new URLSearchParams(String(hash).replace(/^#/,'')).get('token')))return 'legacy';
 if(accountSignedIn)return 'account';
 return validPrivateToken(legacyToken)?'legacy':'account';
}
