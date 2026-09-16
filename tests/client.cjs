const vm=require('node:vm');const fs=require('node:fs');const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');
class Element {
 constructor(){this.value='';this.textContent='';this.style={};this.children=[];this.events={};this.disabled=false;}
 append(...nodes){this.children.push(...nodes)} replaceChildren(...nodes){this.children=nodes} addEventListener(name,fn){this.events[name]=fn} scrollIntoView(){} reportValidity(){return true}
 set innerHTML(_){throw Error('Unsafe HTML rendering')}
}
const values={category:'Malerarbeiten',budget:'Noch offen',description:'Synthetic request',plz:'42103',city:'Wuppertal',when:'Flexibel',name:'Test',phone:'00000',email:'test@example.com'};
async function setup(enabled){
 const nodes={};for(const id of [...Object.keys(values),'jobForm','success','jobList','listStatus','refreshJobs','auftrag','jobs'])nodes[id]=new Element();const button=new Element();
 nodes.jobForm.querySelector=()=>button;nodes.jobForm.reset=()=>{for(const k of Object.keys(values))nodes[k].value=''};
 let fail=true;const requests=[];
 const context=vm.createContext({window:{JOBMARIO_CONFIG:enabled?{supabaseUrl:'https://test.supabase.co',publishableKey:'sb_publishable_test'}:{}},document:{getElementById:id=>nodes[id],createElement:()=>new Element()},crypto:{randomUUID},AbortController,setTimeout,clearTimeout,
 fetch:async(url,options)=>{if(url.endsWith('/list_jobs'))return {ok:true,json:async()=>[{title:'<img onerror=attack()>',category:'Malerarbeiten',budget:'Noch offen',plz:'42103',city:'Wuppertal',start_window:'Flexibel'}]};requests.push({url,body:JSON.parse(options.body)});return {ok:!fail,status:fail?503:200,json:async()=>requests.at(-1).body.p_request_id};}});
 vm.runInContext(fs.readFileSync(__dirname+'/../app.js','utf8'),context);await new Promise(r=>setImmediate(r));
 return {nodes,button,requests,succeed:()=>fail=false};
}
(async()=>{
 const blocked=await setup(false);assert(blocked.button.disabled);
 const s=await setup(true);assert.equal(s.nodes.jobList.children.length,1);assert.equal(s.nodes.jobList.children[0].children[0].children[0].children[1].textContent,'<img onerror=attack()>');
 for(const [k,v]of Object.entries(values))s.nodes[k].value=v;
 await s.nodes.jobForm.events.submit({preventDefault(){}});assert.match(s.nodes.success.textContent,/nicht bestätigt/);assert.equal(s.nodes.name.value,'Test');assert.equal(s.button.disabled,false);
 s.succeed();await s.nodes.jobForm.events.submit({preventDefault(){}});assert.match(s.nodes.success.textContent,/eingegangen/);assert.equal(s.nodes.name.value,'');assert.equal(s.requests[0].body.p_request_id,s.requests[1].body.p_request_id);assert(s.requests[0].url.endsWith('/functions/v1/submit-job'));
 console.log('PASS: client configuration gate, safe text rendering, error/input preservation, retry identity, Edge URL, success reset. DOM and API mocked.');
})().catch(e=>{console.error(e);process.exit(1)});
