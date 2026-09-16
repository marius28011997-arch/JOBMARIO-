'use strict';
const config = window.JOBMARIO_CONFIG || {};
const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl || '') && /^sb_publishable_/.test(config.publishableKey || '');
const form = document.getElementById('jobForm');
const statusBox = document.getElementById('success');
const list = document.getElementById('jobList');
const listStatus = document.getElementById('listStatus');
const submit = form.querySelector('button[type="submit"]');
let sending = false;
let pendingRequest = null;
function goToForm() { document.getElementById('auftrag').scrollIntoView({behavior:'smooth'}); }
function goToJobs() { document.getElementById('jobs').scrollIntoView({behavior:'smooth'}); }
function notice(message, error = false) {
  statusBox.textContent = message;
  statusBox.style.display = 'block';
  statusBox.style.background = error ? '#fff1f0' : '#e9fff0';
  statusBox.style.color = error ? '#9b1c1c' : '#156b38';
}
async function rpc(name, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(config.supabaseUrl + (name === 'submit_job' ? '/functions/v1/submit-job' : '/rest/v1/rpc/' + name), {
      method:'POST', headers:{apikey:config.publishableKey, 'Content-Type':'application/json'},
      body:JSON.stringify(body), signal:controller.signal
    });
    if (!response.ok) { const error = new Error('Request failed'); error.status = response.status; throw error; }
    return await response.json();
  } finally { clearTimeout(timeout); }
}
function element(tag, className, text) {
  const el = document.createElement(tag);
  el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function card(job) {
  const root = element('div', 'job');
  const top = element('div', 'job-top');
  const heading = element('div', '');
  heading.append(element('div','job-category',job.category), element('h3','',job.title));
  top.append(heading, element('div','price',job.budget));
  root.append(top, element('div','job-meta',`${job.plz} ${job.city} · ${job.start_window}`),
    element('div','locked','Kontaktdaten sind nicht öffentlich sichtbar.'));
  return root;
}
async function loadJobs() {
  if (!configured) { listStatus.textContent = 'Die Auftragsvermittlung wird vorbereitet.'; return; }
  listStatus.textContent = 'Aufträge werden geladen …';
  try {
    const jobs = await rpc('list_jobs', {});
    if (!Array.isArray(jobs)) throw new Error('Invalid response');
    list.replaceChildren(...jobs.map(card));
    listStatus.textContent = jobs.length ? 'Freigegebene Aufträge · neueste zuerst' : 'Zurzeit sind keine freigegebenen Aufträge vorhanden.';
  } catch { listStatus.textContent = 'Aufträge konnten nicht geladen werden. Bitte versuchen Sie es erneut.'; }
}
document.getElementById('refreshJobs').addEventListener('click',loadJobs);
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (sending || !form.reportValidity()) return;
  if (!configured) { notice('Die Auftragsannahme ist noch nicht geöffnet.',true); return; }
  const data = {};
  for (const key of ['category','budget','description','plz','city','when','name','phone','email']) {
    data[key] = document.getElementById(key).value.trim();
  }
  // Retrying the same submission after a lost response reuses its identifier.
  const fingerprint = JSON.stringify(data);
  if (!pendingRequest || pendingRequest.fingerprint !== fingerprint) pendingRequest = {fingerprint,id:crypto.randomUUID()};
  sending = true; submit.disabled = true; submit.textContent = 'Wird gesendet …';
  notice('Ihr Auftrag wird übermittelt …');
  try {
    const id = await rpc('submit_job', {p_request_id:pendingRequest.id,p_data:data});
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid receipt');
    form.reset(); pendingRequest = null;
    notice('Ihr Auftrag ist eingegangen und wird vor der Veröffentlichung geprüft.');
  } catch (error) {
    if (error.status === 429) notice('Die Auftragsannahme ist vorübergehend ausgelastet. Bitte später erneut versuchen. Ihre Eingaben bleiben erhalten.',true);
    else notice('Die Übermittlung konnte nicht bestätigt werden. Ihre Eingaben bleiben erhalten. Bitte versuchen Sie es erneut.',true);
  } finally {
    sending = false; submit.disabled = false; submit.textContent = 'Auftrag kostenlos einstellen';
  }
});
if (!configured) { submit.disabled = true; notice('Die Auftragsannahme wird vorbereitet. Bitte noch keine persönlichen Daten eingeben.',true); }
loadJobs();
