// Only synthetic data. Pending test requests are never published.
const {randomUUID}=require('node:crypto');const assert=require('node:assert/strict');
const key='sb_publishable_K19Fn0uYzoTak27v7HeBsQ_C9oFHKmq';
const base='https://alqbxizpxfguymbcfsgv.supabase.co';
(async()=>{
 const id=randomUUID();const headers={'Content-Type':'application/json',apikey:key,Origin:'https://marius28011997-arch.github.io'};
 let res=await fetch(base+'/functions/v1/submit-job',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(res.status,401);
 const body={p_request_id:id,p_data:{category:'Malerarbeiten',budget:'Noch offen',description:'Automated synthetic JOBMARIO smoke test. Delete after validation.',plz:'42103',city:'Wuppertal',when:'Flexibel',name:'JOBMARIO AUTOMATED TEST',phone:'0000000',email:`test-${id}@example.com`}};
 for(let n=0;n<2;n++){
  res=await fetch(base+'/functions/v1/submit-job',{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  const result=await res.text();assert.equal(res.status,200,result);assert.equal(JSON.parse(result),id);
 }
 res=await fetch(base+'/rest/v1/rpc/submit_job',{method:'POST',headers,body:JSON.stringify(body)});assert([401,403,404].includes(res.status));
 res=await fetch(base+'/rest/v1/rpc/list_jobs',{method:'POST',headers,body:'{}'});assert.equal(res.status,200);const rows=await res.json();assert(Array.isArray(rows));assert(!rows.some(row=>row.id===id));assert(rows.every(row=>!('email' in row)&&!('phone' in row)));
 console.log('PASS: live HTTP key validation, save, idempotent retry, direct RPC denial and public listing privacy. Synthetic request ID: '+id);
})().catch(e=>{console.error(e);process.exit(1)});
