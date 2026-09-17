import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,"Content-Type":"application/json"}});
serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 try{
  const auth=req.headers.get("Authorization"); if(!auth)return json({error:"unauthorized"},401);
  const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,sk=Deno.env.get("STRIPE_SECRET_KEY");
  if(!sk)return json({error:"stripe_not_configured"},500);
  const uc=createClient(url,anon,{global:{headers:{Authorization:auth}}}); const {data:{user}}=await uc.auth.getUser(); if(!user)return json({error:"unauthorized"},401);
  const {session_id}=await req.json(); if(!session_id)return json({error:"session_id_required"},400);
  const sr=await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(session_id)}`,{headers:{Authorization:`Bearer ${sk}`}}); const s=await sr.json();
  if(!sr.ok)return json({error:"stripe_error"},502);
  if(s.payment_status!=="paid"||s.amount_total!==2000||s.currency!=="eur"||s.metadata?.contractor_id!==user.id)return json({verified:false},400);
  const job=s.metadata?.job_id; if(!job)return json({verified:false},400);
  const admin=createClient(url,service); const {error}=await admin.rpc("grant_lead_access",{p_job_id:job,p_contractor_id:user.id,p_payment_reference:s.id}); if(error)return json({error:"grant_failed"},500);
  return json({verified:true,job_id:job});
 }catch{return json({error:"internal_error"},500)}
});
