const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({headless:true});
  let fail = true, requests = [], published = [];
  async function pageFor(configured) {
    const context = await browser.newContext({viewport:{width:390,height:844}});
    const page = await context.newPage();
    await page.route('https://test.supabase.co/**', async route => {
      if(route.request().url().endsWith('/list_jobs')) return route.fulfill({json:published});
      const body = route.request().postDataJSON(); requests.push(body);
      return route.fulfill(fail ? {status:503,json:{error:'offline'}} : {json:body.p_request_id});
    });
    await page.route('https://jobmario.test/**', async route => {
      const name = new URL(route.request().url()).pathname.slice(1) || 'index.html';
      const body = name === 'config.js' ? (configured ? "window.JOBMARIO_CONFIG={supabaseUrl:'https://test.supabase.co',publishableKey:'sb_publishable_test'};" : 'window.JOBMARIO_CONFIG={};') : fs.readFileSync(path.join(__dirname,'..',name),'utf8');
      await route.fulfill({body,contentType:name.endsWith('.js')?'text/javascript':'text/html'});
    });
    await page.goto('https://jobmario.test/'); return page;
  }
  try {
    const disabled = await pageFor(false);
    assert.equal(await disabled.locator('.submit').isDisabled(),true);
    assert.match(await disabled.locator('#success').innerText(),/noch keine persönlichen/);
    const page = await pageFor(true);
    await page.selectOption('#category',{label:'Malerarbeiten'});
    await page.selectOption('#budget',{label:'Noch offen'});
    await page.selectOption('#when',{label:'Flexibel'});
    for(const [id,value] of Object.entries({description:'Wohnzimmer streichen bitte',plz:'42103',city:'Wuppertal',name:'Test Person',phone:'+490000000',email:'test@example.com'})) await page.fill('#'+id,value);
    await page.click('.submit');
    await page.waitForFunction(()=>document.getElementById('success').textContent.includes('nicht bestätigt'));
    assert.equal(await page.inputValue('#name'),'Test Person');
    assert.equal(await page.evaluate(()=>localStorage.length),0);
    fail=false;
    await page.click('.submit');
    await page.waitForFunction(()=>document.getElementById('success').textContent.includes('eingegangen'));
    assert.equal(requests[0].p_request_id,requests[1].p_request_id);
    assert.equal(await page.inputValue('#name'),'');
    published=[{id:requests[1].p_request_id,title:'<img src=x onerror="window.pwned=1">',category:'Malerarbeiten',budget:'Noch offen',plz:'42103',city:'Wuppertal',start_window:'Flexibel'}];
    const other = await pageFor(true);
    await other.locator('.job').waitFor();
    assert.equal(await other.locator('.job img').count(),0);
    assert.equal(await other.evaluate(()=>window.pwned),undefined);
    assert.equal(await other.locator('.job h3').innerText(),published[0].title);
    await page.click('#refreshJobs'); await page.locator('.job').waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    console.log('PASS: unconfigured state, failed save preserves inputs, retry UUID, confirmed save, independent browser listing, XSS, mobile width. API responses mocked; real database not tested.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exit(1);});
