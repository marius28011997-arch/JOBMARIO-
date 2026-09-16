const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
let handler,backendCalls=0,backendStatus=200,backendResult='4a344653-2a98-49d8-8a1f-4b8a3a8aa773';
vm.runInNewContext(readFileSync(__dirname+'/../supabase/functions/submit-job/index.ts','utf8'),{
 Deno:{serve(fn){handler=fn},env:{get:k=>k==='SUPABASE_URL'?'https://test.supabase.co':'server-secret'}},Response,TextDecoder,Uint8Array,AbortSignal,
 fetch:async(url,options)=>{backendCalls++;assert.equal(options.headers.Authorization,'Bearer server-secret');return new Response(JSON.stringify(backendResult),{status:backendStatus});}
});
const key='sb_publishable_K19Fn0uYzoTak27v7HeBsQ_C9oFHKmq';
const data={p_request_id:'4a344653-2a98-49d8-8a1f-4b8a3a8aa773',p_data:{category:'Malerarbeiten',budget:'Noch offen',description:'A synthetic job',plz:'42103',city:'Wuppertal',when:'Flexibel',name:'Test',phone:'00000',email:'test@example.com'}};
const request=(body=data,extra={})=>new Request('https://test/submit-job',{method:'POST',headers:{apikey:key,'content-type':'application/json',...extra},body:JSON.stringify(body)});
(async()=>{
 assert.equal((await handler(request(data,{apikey:'wrong'}))).status,401);
 assert.equal((await handler(request(data,{origin:'https://evil.example'}))).status,403);
 assert.equal((await handler(request({p_data:{}}))).status,400);
 assert.equal((await handler(request({x:'x'.repeat(12001)}))).status,413);
 assert.equal(backendCalls,0);
 const response=await handler(request()); assert.equal(response.status,200); assert.equal(await response.json(),data.p_request_id);
 backendStatus=400;backendResult={message:'intake_rate_limit'};assert.equal((await handler(request())).status,429);
 backendResult={code:'23514'};assert.equal((await handler(request())).status,400);
 backendResult={code:'XX000',message:'private details'};const failure=await handler(request());assert.equal(failure.status,503);assert(!((await failure.text()).includes('private details')));
 console.log('PASS: Edge handler key check, origin check, input/body limits, save receipt, quota errors and private-error redaction. Backend mocked.');
})().catch(e=>{console.error(e);process.exit(1)});
