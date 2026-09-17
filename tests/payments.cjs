const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {stripTypeScriptTypes}=require('node:module');
const uid='27ad4c7e-1e26-48e2-ba5d-1128a341b9b6',job='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
function setup(file,options={}){
 let handler,grants=0,submitted;
 const session={id:'cs_test_sample',metadata:{contractor_id:uid,job_id:job,app:'AuftragPilot'},client_reference_id:uid,livemode:false,mode:'payment',currency:'eur',amount_total:2000,status:'complete',payment_status:'paid',...options.session};
 const db={auth:{getUser:async()=>({data:{user:options.badAuth?null:{id:uid}},error:null})},from:()=>({select(){return this},eq(){return this},async maybeSingle(){return {data:options.noProfile?null:{id:job,user_id:uid}}}}),rpc:async(name)=>{if(name==='grant_lead_access'&&!options.dbError)grants++;return {data:false,error:options.dbError?{}:null}}};
 const context={Request,Response,URLSearchParams,console,Deno:{env:{get:n=>n==='STRIPE_SECRET_KEY'?(options.liveKey?'sk_live_fixture':'sk_test_fixture'):'fixture'},serve:fn=>handler=fn},createClient:()=>db,fetch:async(url,init)=>{submitted=init?.body;return Response.json(file==='checkout.ts'?{url:'https://checkout.stripe.com/test'}:session)}};
 const source=fs.readFileSync(require('node:path').join(__dirname,'../supabase/functions',({'checkout.ts':'create-lead-checkout','verify.ts':'verify-lead-payment'})[file],'index.ts'),'utf8').replace(/^import .*;\n/gm,'');
 vm.runInNewContext(stripTypeScriptTypes(source),context);
 return {call:(body={},auth=true)=>handler(new Request('https://example.test',{method:'POST',headers:auth?{Authorization:'Bearer fixture'}:{},body:JSON.stringify(body)})),grants:()=>grants,submitted:()=>submitted};
}
(async()=>{
 let count=0;
 for(const [opts,status,granted] of [[{},200,1],[{badAuth:true},401,0],[{session:{client_reference_id:'other'}},403,0],[{session:{amount_total:1}},400,0],[{session:{livemode:true}},400,0],[{session:{payment_status:'unpaid'}},200,0],[{session:{status:'open'}},200,0],[{noProfile:true},400,0],[{dbError:true},500,0],[{liveKey:true},500,0]]){
 const t=setup('verify.ts',opts),r=await t.call({session_id:'cs_test_sample'});assert.equal(r.status,status);assert.equal(t.grants(),granted);count++;
 }
 let t=setup('verify.ts');assert.equal((await t.call({session_id:'cs_live_invalid'})).status,400);count++;
 t=setup('verify.ts');assert.equal((await t.call({},false)).status,401);count++;
 t=setup('checkout.ts');assert.equal((await t.call({job_id:job})).status,200);assert.ok(t.submitted().get('success_url').includes('session_id={CHECKOUT_SESSION_ID}'));count++;
 t=setup('checkout.ts',{noProfile:true});assert.equal((await t.call({job_id:job})).status,403);count++;
 console.log(count+' payment authorization and checkout tests passed');
})().catch(e=>{console.error(e);process.exitCode=1});
