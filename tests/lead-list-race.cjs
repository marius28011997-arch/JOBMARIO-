const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/../betrieb.js','utf8');
const code=src.slice(src.indexOf('let leadLoadVersion'),src.indexOf('async function refresh'));
const pending=[];
const list={children:[],replaceChildren(fragment){this.children=fragment?fragment.children:[]}};
function node(){return {children:[],appendChild(n){this.children.push(n)},addEventListener(){}}}
const ctx={leadList:list,leadsStatus:{classList:{add(){}}},document:{createDocumentFragment:node,createElement:node},client:{rpc:()=>new Promise(r=>pending.push(r))},unlocked:async()=>null,esc:String,show(){},buy(){}};
vm.createContext(ctx);vm.runInContext(code,ctx);
(async()=>{
 const older=ctx.loadLeads(),newer=ctx.loadLeads();
 pending[1]({data:[{id:'new'}]});await newer;
 assert.equal(list.children.length,1);
 const current=list.children[0];
 pending[0]({data:[{id:'old'},{id:'old2'}]});await older;
 assert.equal(list.children.length,1);assert.equal(list.children[0],current);
 console.log('PASS: older requests cannot duplicate or overwrite the current lead list');
})().catch(e=>{console.error(e);process.exitCode=1});
