import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});

serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  try{
    const auth=req.headers.get("Authorization");
    if(!auth) return json({error:"unauthorized"},401);
    const url=Deno.env.get("SUPABASE_URL")!;
    const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
    const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeKey=Deno.env.get("STRIPE_SECRET_KEY");
    if(!stripeKey) return json({error:"stripe_not_configured"},500);
    const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
    const {data:{user}}=await userClient.auth.getUser();
    if(!user) return json({error:"unauthorized"},401);
    const {job_id}=await req.json();
    if(!job_id) return json({error:"job_id_required"},400);
    const {data:existing}=await userClient.rpc("get_unlocked_lead",{p_job_id:job_id});
    if(Array.isArray(existing)&&existing.length) return json({already_unlocked:true});
    const admin=createClient(url,service);
    const {data:job}=await admin.from("published_jobs").select("id,title,category,city").eq("id",job_id).maybeSingle();
    if(!job) return json({error:"job_not_found"},404);
    const origin="https://marius28011997-arch.github.io/JOBMARIO-/betrieb.html";
    const form=new URLSearchParams();
    form.set("mode","payment");
    form.set("success_url",origin+"?payment=success&session_id={CHECKOUT_SESSION_ID}");
    form.set("cancel_url",origin+"?payment=cancelled");
    form.set("client_reference_id",user.id);
    form.set("metadata[job_id]",job_id);
    form.set("metadata[contractor_id]",user.id);
    form.set("line_items[0][price_data][currency]","eur");
    form.set("line_items[0][price_data][unit_amount]","2000");
    form.set("line_items[0][price_data][product_data][name]","JOBMARIO Lead freischalten");
    form.set("line_items[0][price_data][product_data][description]",`${job.category} · ${job.city}`);
    form.set("line_items[0][quantity]","1");
    const sr=await fetch("https://api.stripe.com/v1/checkout/sessions",{method:"POST",headers:{Authorization:`Bearer ${stripeKey}`,"Content-Type":"application/x-www-form-urlencoded"},body:form});
    const session=await sr.json();
    if(!sr.ok) return json({error:"stripe_error"},502);
    return json({url:session.url});
  }catch(e){return json({error:"internal_error"},500)}
});
