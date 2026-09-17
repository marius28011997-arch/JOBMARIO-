import { createClient } from "npm:@supabase/supabase-js@2.95.0";
const cors={"Access-Control-Allow-Origin":"https://marius28011997-arch.github.io","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"method_not_allowed"},405);
 try{
 const auth=req.headers.get("Authorization");
 if(!auth?.startsWith("Bearer "))return json({error:"unauthorized"},401);
 const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
 const {data:{user},error:authError}=await admin.auth.getUser(auth.slice(7));
 if(authError||!user)return json({error:"unauthorized"},401);
 const body=await req.json().catch(()=>({}));
 const sid=String(body.session_id||"");
 if(!/^cs_test_[a-zA-Z0-9]+$/.test(sid))return json({error:"invalid_session"},400);
 const key=Deno.env.get("STRIPE_SECRET_KEY");
 if(!key||!/^(sk|rk)_test_/.test(key))return json({error:"stripe_not_configured"},500);
 const response=await fetch("https://api.stripe.com/v1/checkout/sessions/"+encodeURIComponent(sid),{headers:{Authorization:"Bearer "+key}});
 if(!response.ok)return json({error:"session_lookup_failed"},502);
 const s=await response.json();
 if(s.metadata?.contractor_id!==user.id||s.client_reference_id!==user.id)return json({error:"forbidden"},403);
 if(s.livemode!==false||s.mode!=="payment"||s.metadata?.app!=="AuftragPilot"||s.currency!=="eur"||s.amount_total!==2000)return json({error:"invalid_payment"},400);
 if(s.status!=="complete"||s.payment_status!=="paid")return json({verified:false,pending:true});
 const jobId=s.metadata?.job_id;
 if(!/^[0-9a-f-]{36}$/i.test(jobId||""))return json({error:"invalid_job"},400);
 const [{data:job,error:je},{data:profile,error:pe}]=await Promise.all([
 admin.from("published_jobs").select("id").eq("id",jobId).maybeSingle(),
 admin.from("contractor_profiles").select("user_id").eq("user_id",user.id).maybeSingle()
 ]);
 if(je||pe)return json({error:"lookup_failed"},500);
 if(!job||!profile)return json({error:"invalid_metadata"},400);
 const {error}=await admin.rpc("grant_lead_access",{p_job_id:jobId,p_contractor_id:user.id,p_payment_reference:s.id});
 if(error)return json({error:"access_grant_failed"},500);
 return json({verified:true,job_id:jobId});
 }catch{return json({error:"server_error"},500)}
});
