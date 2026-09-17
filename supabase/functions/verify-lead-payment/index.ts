import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigin="https://marius28011997-arch.github.io";
const cors={"Access-Control-Allow-Origin":allowedOrigin,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});

serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return json({error:"method_not_allowed"},405);
  try{
    const auth=req.headers.get("Authorization");
    if(!auth) return json({error:"unauthorized"},401);
    const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,sk=Deno.env.get("STRIPE_SECRET_KEY");
    if(!sk) return json({error:"stripe_not_configured"},500);
    const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
    const {data:{user}}=await userClient.auth.getUser();
    if(!user) return json({error:"unauthorized"},401);
    const body=await req.json().catch(()=>null);
    const sessionId=typeof body?.session_id==="string"?body.session_id.trim():"";
    if(!/^cs_(test_|live_)?[A-Za-z0-9_]+$/.test(sessionId)) return json({error:"invalid_session_id"},400);
    const sr=await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,{headers:{Authorization:`Bearer ${sk}`}});
    const session=await sr.json();
    if(!sr.ok) return json({error:"stripe_error"},502);
    const valid=session.payment_status==="paid"&&session.status==="complete"&&session.mode==="payment"&&session.amount_total===2000&&session.currency==="eur"&&session.client_reference_id===user.id&&session.metadata?.contractor_id===user.id;
    if(!valid) return json({verified:false},400);
    const jobId=typeof session.metadata?.job_id==="string"?session.metadata.job_id:"";
    if(!jobId) return json({verified:false},400);
    const admin=createClient(url,service);
    const {data:job}=await admin.from("published_jobs").select("id").eq("id",jobId).maybeSingle();
    if(!job) return json({verified:false},400);
    const {error}=await admin.rpc("grant_lead_access",{p_job_id:jobId,p_contractor_id:user.id,p_payment_reference:session.id});
    if(error) return json({error:"grant_failed"},500);
    return json({verified:true,job_id:jobId});
  }catch{return json({error:"internal_error"},500)}
});
