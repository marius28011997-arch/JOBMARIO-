// Anonymous intake: the publishable key identifies this app, not the customer.
// Database quotas are enforced server-side; direct anonymous RPC stays revoked.
const PUBLIC_KEY = 'sb_publishable_K19Fn0uYzoTak27v7HeBsQ_C9oFHKmq';
const ORIGIN = 'https://marius28011997-arch.github.io';
const headers = {'Content-Type':'application/json','Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
Deno.serve(async req => {
  const reply = (body,status=200) => new Response(JSON.stringify(body),{status,headers});
  if (req.headers.get('origin') && req.headers.get('origin') !== ORIGIN) return reply({error:'origin_not_allowed'},403);
  if (req.method === 'OPTIONS') return new Response(null,{status:204,headers});
  if (req.method !== 'POST') return reply({error:'method_not_allowed'},405);
  if (req.headers.get('apikey') !== PUBLIC_KEY) return reply({error:'invalid_app_key'},401);
  if (!req.headers.get('content-type')?.startsWith('application/json')) return reply({error:'json_required'},415);
  try {
    const reader = req.body?.getReader();
    if (!reader) return reply({error:'empty_body'},400);
    const chunks=[]; let length=0;
    while (true) {
      const {value,done}=await reader.read(); if(done) break;
      length+=value.byteLength;
      if(length>12000) {await reader.cancel(); return reply({error:'body_too_large'},413);}
      chunks.push(value);
    }
    const bytes=new Uint8Array(length); let offset=0;
    for(const chunk of chunks) {bytes.set(chunk,offset);offset+=chunk.byteLength;}
    let body;
    try {body=JSON.parse(new TextDecoder().decode(bytes));} catch {return reply({error:'invalid_json'},400);}
    if(!body || typeof body !== 'object' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.p_request_id || '') || !body.p_data || typeof body.p_data !== 'object' || Array.isArray(body.p_data)) return reply({error:'invalid_submission'},400);
    const required=['category','budget','description','plz','city','when','name','phone','email'];
    if(required.some(key=>typeof body.p_data[key] !== 'string')) return reply({error:'invalid_fields'},400);
    const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const url=Deno.env.get('SUPABASE_URL');
    if(!serviceKey || !url) return reply({error:'service_unavailable'},503);
    const response=await fetch(url+'/rest/v1/rpc/submit_job',{
      method:'POST',headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'},
      body:JSON.stringify({p_request_id:body.p_request_id,p_data:body.p_data}),signal:AbortSignal.timeout(10000)
    });
    const result=await response.json();
    if(!response.ok) {
      if(result.message==='intake_rate_limit') return reply({error:'rate_limit'},429);
      if(['23514','23502','22023','22P02'].includes(result.code)) return reply({error:'invalid_fields'},400);
      return reply({error:'save_failed'},503);
    }
    if(typeof result!=='string') return reply({error:'invalid_receipt'},503);
    return reply(result);
  } catch {return reply({error:'service_unavailable'},503);}
});
