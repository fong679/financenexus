// ═══════════════════════════════════════════════════════════════
//  ⚙️  SUPABASE CONFIG — Replace these two values
//  1. Go to supabase.com → your project → Settings → API
//  2. Copy "Project URL" and "anon public" key and paste below
// ═══════════════════════════════════════════════════════════════
const SUPABASE_URL  = 'https://sqmpedbzaodjreflnqtk.supabase.co';
const SUPABASE_ANON = 'QiOjE3NzE1MjQ0ODcsImV4cCI6MjA4NzEwMDQ4N30.qyUCwrgKEbO4kkgzR6wa_uFioxFu7CnlmsvsOOqyRBQ';

// ═══════════════════════════════════════════════════════════════
//  SUPABASE SQL — Run this once in your Supabase SQL Editor:
//
//  CREATE TABLE saved_calculations (
//    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
//    label TEXT NOT NULL,
//    calculator_type TEXT NOT NULL,
//    inputs JSONB NOT NULL,
//    result_summary TEXT,
//    created_at TIMESTAMPTZ DEFAULT NOW()
//  );
//  ALTER TABLE saved_calculations ENABLE ROW LEVEL SECURITY;
//  CREATE POLICY "Users manage own calcs" ON saved_calculations
//    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
// ═══════════════════════════════════════════════════════════════

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON);
let currentUser = null, allSaved = [];

// ─── AUTH ────────────────────────────────────────────────────
function authTab(t){
  document.querySelectorAll('.auth-tab').forEach((el,i)=>el.classList.toggle('active',(i===0&&t==='login')||(i===1&&t==='register')));
  G('auth-login').classList.toggle('active',t==='login');
  G('auth-register').classList.toggle('active',t==='register');
}
async function doLogin(){
  const email=G('login-email').value.trim(), pass=G('login-password').value;
  const btn=G('login-btn'), msg=G('login-msg');
  if(!email||!pass){showMsg(msg,'error','Please enter email and password.');return;}
  btn.disabled=true; btn.textContent='Signing in…';
  const{data,error}=await sb.auth.signInWithPassword({email,password:pass});
  btn.disabled=false; btn.textContent='Sign In →';
  if(error){showMsg(msg,'error',error.message);return;}
  onLogin(data.user);
}
async function doRegister(){
  const name=G('reg-name').value.trim(),email=G('reg-email').value.trim(),pass=G('reg-password').value,conf=G('reg-confirm').value;
  const btn=G('reg-btn'),msg=G('reg-msg');
  if(!name||!email||!pass||!conf){showMsg(msg,'error','All fields are required.');return;}
  if(pass.length<8){showMsg(msg,'error','Password must be at least 8 characters.');return;}
  if(pass!==conf){showMsg(msg,'error','Passwords do not match.');return;}
  btn.disabled=true; btn.textContent='Creating account…';
  const{error}=await sb.auth.signUp({email,password:pass,options:{data:{full_name:name},emailRedirectTo:'https://fong679.github.io/financenexus/'}});
  btn.disabled=false; btn.textContent='Create Account & Verify Email →';
  if(error){showMsg(msg,'error',error.message);return;}
  // Show the beautiful popup instead of inline message
  G('popup-email-display').textContent=email;
  G('email-popup-overlay').classList.add('open');
  // Clear the form
  G('reg-name').value=''; G('reg-email').value=''; G('reg-password').value=''; G('reg-confirm').value='';
  msg.style.display='none';
}
function closeEmailPopup(){
  G('email-popup-overlay').classList.remove('open');
  // Switch to sign in tab so user can log in after verifying
  authTab('login');
}
async function resendVerification(){
  const email=G('popup-email-display').textContent;
  if(!email||email==='you@example.com')return;
  const{error}=await sb.auth.resend({type:'signup',email,options:{emailRedirectTo:'https://fong679.github.io/financenexus/'}});
  if(error){toast('Error: '+error.message,'error');return;}
  toast('✅ Verification email resent!','success');
}
async function doReset(){
  const email=G('login-email').value.trim();
  if(!email){showMsg(G('login-msg'),'error','Enter your email address first.');return;}
  const{error}=await sb.auth.resetPasswordForEmail(email,{
    redirectTo:'https://fong679.github.io/financenexus/'
  });
  if(error){showMsg(G('login-msg'),'error',error.message);return;}
  showMsg(G('login-msg'),'success','Password reset email sent! Check your inbox.');
}
async function doSignOut(){
  closeProfileMenu();
  await sb.auth.signOut(); currentUser=null;
  G('app-screen').style.display='none'; G('auth-screen').style.display='flex';
  toast('Signed out successfully.');
}
function onLogin(user){
  currentUser=user;
  const name=user.user_metadata?.full_name||user.email.split('@')[0];
  const email=user.email||'';
  const initial=name.charAt(0).toUpperCase();
  // Topbar chip
  G('user-name-display').textContent=name;
  G('user-email-display').textContent=email;
  G('user-avatar').textContent=initial;
  // Dropdown header
  G('drop-avatar').textContent=initial;
  G('drop-name').textContent=name;
  G('drop-email').textContent=email;
  G('auth-screen').style.display='none'; G('app-screen').style.display='block';
  loadSaved(); calcMortgage(); calcVehicle(); calcPersonal(); calcSavings();
}
function showMsg(el,type,text){el.className=`auth-msg ${type}`;el.textContent=text;el.style.display='block';}

// ─── PROFILE DROPDOWN ─────────────────────────────────────────
function toggleProfileMenu(){
  const chip=G('user-chip'),drop=G('profile-dropdown');
  const isOpen=drop.classList.contains('open');
  if(isOpen){closeProfileMenu();}else{chip.classList.add('open');drop.classList.add('open');}
}
function closeProfileMenu(){G('user-chip').classList.remove('open');G('profile-dropdown').classList.remove('open');}

// Close when clicking outside
document.addEventListener('click',e=>{
  const wrap=G('profile-wrap');
  if(wrap&&!wrap.contains(e.target))closeProfileMenu();
});

// ─── CHANGE PASSWORD ──────────────────────────────────────────
function openChangePassword(){
  closeProfileMenu();
  G('cpw-new').value=''; G('cpw-confirm').value='';
  G('cpw-msg').style.display='none';
  G('cpw-btn').disabled=false; G('cpw-btn').textContent='Update Password';
  G('cpw-modal').classList.add('open');
  setTimeout(()=>G('cpw-new').focus(),100);
}
function closeChangePassword(){G('cpw-modal').classList.remove('open');}
async function submitChangePassword(){
  const np=G('cpw-new').value, cf=G('cpw-confirm').value;
  const msg=G('cpw-msg'), btn=G('cpw-btn');
  msg.style.display='none';
  if(!np||!cf){showCpwMsg('error','Please fill in both fields.');return;}
  if(np.length<8){showCpwMsg('error','Password must be at least 8 characters.');return;}
  if(np!==cf){showCpwMsg('error','Passwords do not match.');return;}
  btn.disabled=true; btn.textContent='Updating…';
  const{error}=await sb.auth.updateUser({password:np});
  btn.disabled=false; btn.textContent='Update Password';
  if(error){showCpwMsg('error',error.message);return;}
  showCpwMsg('success','✅ Password updated successfully!');
  setTimeout(()=>closeChangePassword(),2000);
}
function showCpwMsg(type,text){const m=G('cpw-msg');m.className=`cpw-msg ${type}`;m.textContent=text;m.style.display='block';}

// Session restore + share link on load
// ─── SESSION & EMAIL CONFIRMATION HANDLER ────────────────────
// Supabase puts the token in the URL hash after email confirmation.
// onAuthStateChange fires automatically when the hash is detected,
// so we don't need to parse it manually.
sb.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session) {
    // Clean the token hash from the URL without triggering a reload
    if (window.location.hash && window.location.hash.includes('access_token')) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    if (!currentUser) onLogin(session.user);
  }
  if (event === 'SIGNED_OUT') {
    currentUser = null;
    G('app-screen').style.display = 'none';
    G('auth-screen').style.display = 'flex';
  }
  if (event === 'PASSWORD_RECOVERY') {
    // Show change password immediately if arriving from reset email
    setTimeout(() => openChangePassword(), 500);
  }
});

// Restore existing session on page load
(async()=>{
  const{data}=await sb.auth.getSession();
  if(data.session && !currentUser) onLogin(data.session.user);
  const p=new URLSearchParams(window.location.search);
  if(p.get('share')) loadSharedCalc(p.get('share'));
})();

// ─── SAVE / LOAD ─────────────────────────────────────────────
function G(id){return document.getElementById(id);}
const v=id=>parseFloat(G(id).value)||0;

function getInputs(type){
  if(type==='mortgage') return{price:v('m-price'),down:v('m-down'),rate:v('m-rate'),term:v('m-term'),tax:v('m-tax'),ins:v('m-ins')};
  if(type==='vehicle')  return{price:v('v-price'),tradein:v('v-tradein'),down:v('v-down'),taxRate:v('v-tax'),rate:v('v-rate'),term:v('v-term')};
  if(type==='personal') return{amount:v('p-amount'),rate:v('p-rate'),term:v('p-term')};
  if(type==='savings')  return{initial:v('s-initial'),monthly:v('s-monthly'),rate:v('s-rate'),years:v('s-years'),freq:savingsFreq};
}
function getSummary(type){
  if(type==='mortgage') return`P&I: ${G('m-out-pi').textContent} | Total Monthly: ${G('m-out-total').textContent} | Loan: ${G('m-out-loan').textContent}`;
  if(type==='vehicle')  return`Monthly: ${G('v-out-monthly').textContent} | Loan: ${G('v-out-loan').textContent} | Total Interest: ${G('v-out-interest').textContent}`;
  if(type==='personal') return`Monthly: ${G('p-out-monthly').textContent} | Total Interest: ${G('p-out-interest').textContent} | Total Paid: ${G('p-out-total').textContent}`;
  if(type==='savings')  return`Final Value: ${G('s-out-final').textContent} | Invested: ${G('s-out-contrib').textContent} | Growth: ${G('s-out-growth').textContent}`;
}
async function saveCalc(type){
  if(!currentUser){toast('Please sign in first.','error');return;}
  const lid=`${type.charAt(0)}-save-label`;
  const label=G(lid).value.trim()||`${type} — ${new Date().toLocaleDateString('en-FJ')}`;
  const{error}=await sb.from('saved_calculations').insert({user_id:currentUser.id,label,calculator_type:type,inputs:getInputs(type),result_summary:getSummary(type)});
  if(error){toast('Error: '+error.message,'error');return;}
  toast('✅ Saved!','success'); G(lid).value=''; loadSaved();
}
async function loadSaved(){
  if(!currentUser)return;
  const{data}=await sb.from('saved_calculations').select('*').eq('user_id',currentUser.id).order('created_at',{ascending:false});
  allSaved=data||[]; renderSaved(allSaved); populateCompareSelects();
}
function filterSaved(type,btn){
  document.querySelectorAll('#filter-btns .btn').forEach(b=>b.style.borderColor='');
  btn.style.borderColor='var(--primary)';
  renderSaved(type==='all'?allSaved:allSaved.filter(c=>c.calculator_type===type));
}
const typeIcon={mortgage:'🏠',vehicle:'🚗',personal:'💳',savings:'📈'};
function renderSaved(list){
  const c=G('saved-list-container');
  if(!list.length){c.innerHTML='<div style="text-align:center;color:var(--muted);padding:60px 20px;font-size:14px">No saved calculations yet.<br>Use the 💾 Save bar on any calculator!</div>';return;}
  c.innerHTML=`<div class="saved-list">${list.map(s=>`<div class="saved-card">
    <div class="saved-card-header"><div><div class="saved-card-title">${typeIcon[s.calculator_type]||''} ${esc(s.label)}</div><span class="saved-card-type type-${s.calculator_type}">${s.calculator_type}</span></div></div>
    <div class="saved-card-summary">${esc(s.result_summary||'')}</div>
    <div class="saved-card-actions">
      <button class="btn btn-primary btn-sm" onclick="reloadCalc('${s.id}')">↩ Load</button>
      <button class="btn btn-outline btn-sm" onclick="shareCalc('${s.id}')">🔗 Share</button>
      <button class="btn btn-outline btn-sm" onclick="exportSinglePDF('${s.id}')">📄 PDF</button>
      <button class="btn btn-danger" onclick="deleteCalc('${s.id}')">🗑</button>
    </div>
    <div class="saved-date">Saved ${new Date(s.created_at).toLocaleString('en-FJ')}</div>
  </div>`).join('')}</div>`;
}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
async function deleteCalc(id){
  if(!confirm('Delete this saved calculation?'))return;
  await sb.from('saved_calculations').delete().eq('id',id);
  toast('Deleted.'); loadSaved();
}
function setF(inputId,val,sliderId){G(inputId).value=val;if(sliderId)G(sliderId).value=val;}
function reloadCalc(id){
  const s=allSaved.find(x=>x.id===id); if(!s)return;
  const i=s.inputs;
  if(s.calculator_type==='mortgage'){setF('m-price',i.price,'ms-price');setF('m-down',i.down,'ms-down');setF('m-rate',i.rate,'ms-rate');setF('m-term',i.term,'ms-term');setF('m-tax',i.tax,'ms-tax');setF('m-ins',i.ins,'ms-ins');switchTabById('mortgage');calcMortgage();}
  else if(s.calculator_type==='vehicle'){setF('v-price',i.price,'vs-price');setF('v-tradein',i.tradein,'vs-tradein');setF('v-down',i.down,'vs-down');setF('v-tax',i.taxRate,'vs-tax');setF('v-rate',i.rate,'vs-rate');setF('v-term',i.term,'vs-term');switchTabById('vehicle');calcVehicle();}
  else if(s.calculator_type==='personal'){setF('p-amount',i.amount,'ps-amount');setF('p-rate',i.rate,'ps-rate');setF('p-term',i.term,'ps-term');switchTabById('personal');calcPersonal();}
  else if(s.calculator_type==='savings'){setF('s-initial',i.initial,'ss-initial');setF('s-monthly',i.monthly,'ss-monthly');setF('s-rate',i.rate,'ss-rate');setF('s-years',i.years,'ss-years');setFreq(i.freq||'monthly');switchTabById('savings');calcSavings();}
  toast('✅ Calculation loaded!','success');
}
function switchTabById(id){const btn=Array.from(document.querySelectorAll('.nav-item')).find(b=>(b.getAttribute('onclick')||'').includes(`'${id}'`));if(btn)switchTab(id,btn);}

// ─── SHARE ────────────────────────────────────────────────────
function shareCalc(id){G('share-link-val').value=`${location.origin}${location.pathname}?share=${id}`;G('share-modal').classList.add('open');}
function closeShareModal(){G('share-modal').classList.remove('open');}
function copyShareLink(){navigator.clipboard.writeText(G('share-link-val').value).then(()=>toast('🔗 Link copied!','success'));}
async function loadSharedCalc(id){
  const{data}=await sb.from('saved_calculations').select('*').eq('id',id).single();
  if(!data)return;
  const overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML=`<div style="background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:32px;max-width:460px;width:calc(100% - 40px);box-shadow:0 25px 60px rgba(0,0,0,0.5)">
    <div style="font-size:18px;font-weight:700;margin-bottom:6px">📊 Shared Calculation</div>
    <div style="font-size:22px;font-weight:700;color:var(--primary-light);margin:10px 0">${esc(data.label)}</div>
    <div style="font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">${data.calculator_type} calculator</div>
    <div style="font-size:14px;color:var(--text);padding:13px;background:var(--surface-high);border-radius:9px;margin-bottom:14px">${esc(data.result_summary||'')}</div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:18px">Shared on ${new Date(data.created_at).toLocaleDateString('en-FJ')}</div>
    <div style="display:flex;gap:10px">
      <a href="${location.origin}${location.pathname}" style="flex:1;text-align:center;padding:11px;background:var(--primary);color:white;border-radius:9px;text-decoration:none;font-weight:700;font-size:14px">Open Calculator</a>
      <button onclick="this.closest('[style]').remove()" style="padding:11px 18px;background:transparent;border:1px solid var(--border);color:var(--text);border-radius:9px;cursor:pointer;font-size:14px">Close</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
}

// ─── PDF EXPORT ───────────────────────────────────────────────
async function exportSinglePDF(id){
  const s=allSaved.find(x=>x.id===id);if(!s)return;
  const{jsPDF}=window.jspdf,doc=new jsPDF();
  doc.setFont('helvetica','bold');doc.setFontSize(20);doc.setTextColor(79,70,229);
  doc.text('Finance Calculator — Fiji',14,18);
  doc.setFontSize(15);doc.setTextColor(30,30,30);doc.text(s.label,14,32);
  doc.setFont('helvetica','normal');doc.setFontSize(10);doc.setTextColor(100,116,139);
  doc.text(`Type: ${s.calculator_type.charAt(0).toUpperCase()+s.calculator_type.slice(1)}  |  Saved: ${new Date(s.created_at).toLocaleString('en-FJ')}`,14,41);
  doc.setDrawColor(79,70,229);doc.setLineWidth(0.4);doc.line(14,45,196,45);
  doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(30,30,30);doc.text('Results',14,54);
  doc.setFont('helvetica','normal');doc.setFontSize(11);doc.setTextColor(50,50,50);
  doc.text(doc.splitTextToSize(s.result_summary||'',175),14,63);
  doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(30,30,30);doc.text('Input Parameters',14,90);
  doc.setFont('helvetica','normal');doc.setFontSize(10);doc.setTextColor(70,70,70);
  let y=100;Object.entries(s.inputs).forEach(([k,val])=>{doc.text(`${k}: ${val}`,18,y);y+=8;});
  doc.setFontSize(8);doc.setTextColor(148,163,184);
  doc.text('Rates indicative only. Verify with your bank. fong679.github.io/financenexus',14,285);
  doc.save(`${s.label.replace(/\s+/g,'-')}.pdf`);
  toast('📄 PDF exported!','success');
}
async function exportComparePDF(){
  const idA=G('compare-a').value,idB=G('compare-b').value;
  if(!idA||!idB){toast('Select two scenarios first.','error');return;}
  const a=allSaved.find(x=>x.id===idA),b=allSaved.find(x=>x.id===idB);
  const{jsPDF}=window.jspdf,doc=new jsPDF();
  doc.setFont('helvetica','bold');doc.setFontSize(18);doc.setTextColor(79,70,229);
  doc.text('Finance Calculator — Comparison Report',14,18);
  doc.setDrawColor(79,70,229);doc.setLineWidth(0.4);doc.line(14,22,196,22);
  [[a,14],[b,110]].forEach(([c,x])=>{
    doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(30,30,30);doc.text(c.label,x,32);
    doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(100,116,139);doc.text(c.calculator_type,x,39);
    doc.setFontSize(10);doc.setTextColor(50,50,50);
    doc.text(doc.splitTextToSize(c.result_summary||'',78),x,46);
    let y2=72;Object.entries(c.inputs).forEach(([k,v2])=>{doc.text(`${k}: ${v2}`,x+2,y2);y2+=7;});
  });
  doc.setFontSize(8);doc.setTextColor(148,163,184);
  doc.text('Rates indicative only. fong679.github.io/financenexus',14,285);
  doc.save('comparison-report.pdf');toast('📄 PDF ready!','success');
}

// ─── COMPARE ─────────────────────────────────────────────────
function populateCompareSelects(){
  const opts=allSaved.map(c=>`<option value="${c.id}">${c.calculator_type.toUpperCase()} — ${esc(c.label)}</option>`).join('');
  G('compare-a').innerHTML='<option value="">— Select Scenario A —</option>'+opts;
  G('compare-b').innerHTML='<option value="">— Select Scenario B —</option>'+opts;
}
function runCompare(){
  const idA=G('compare-a').value,idB=G('compare-b').value;
  if(!idA||!idB){toast('Select two scenarios.','error');return;}
  if(idA===idB){toast('Select two different scenarios.','error');return;}
  const a=allSaved.find(x=>x.id===idA),b=allSaved.find(x=>x.id===idB);
  const col=c=>`<div class="compare-col">
    <div class="compare-col-header">${typeIcon[c.calculator_type]||''} ${esc(c.label)}<br><span style="font-size:11px;color:var(--muted);font-weight:400">${c.calculator_type} · ${new Date(c.created_at).toLocaleDateString('en-FJ')}</span></div>
    <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:5px">Results</div>
    ${(c.result_summary||'').split('|').map(s=>{const[k,v2]=(s||'').split(':');return k&&v2?`<div class="compare-row"><span class="compare-key">${k.trim()}</span><span class="compare-val highlight">${v2.trim()}</span></div>`:''}).join('')}
    <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em;margin:10px 0 5px">Inputs</div>
    ${Object.entries(c.inputs).map(([k,v2])=>`<div class="compare-row"><span class="compare-key">${k}</span><span class="compare-val">${v2}</span></div>`).join('')}
  </div>`;
  G('compare-output').innerHTML=`<div class="compare-grid">${col(a)}${col(b)}</div>`;
}

// ─── THEME ────────────────────────────────────────────────────
function toggleTheme(){
  const isLight=document.documentElement.classList.toggle('light');
  G('theme-btn').textContent=isLight?'☀️':'🌙';
  const tick=isLight?'#475569':'#94A3B8',grid=isLight?'rgba(203,213,225,0.6)':'rgba(51,65,85,0.5)';
  Object.values(charts).forEach(ch=>{
    ['x','y'].forEach(ax=>{ch.options.scales[ax].grid.color=grid;ch.options.scales[ax].ticks.color=tick;});
    ch.options.plugins.legend.labels.color=tick;
    ch.options.plugins.tooltip.backgroundColor=isLight?'#fff':'#1E293B';
    ch.options.plugins.tooltip.titleColor=isLight?'#0F172A':'#F1F5F9';
    ch.options.plugins.tooltip.bodyColor=tick; ch.update();
  });
}

// ─── TOAST ────────────────────────────────────────────────────
function toast(msg,type='success'){
  const t=G('toast');t.textContent=msg;t.className='show '+(type||'');
  clearTimeout(t._t);t._t=setTimeout(()=>t.className='',3200);
}

// ─── CHART HELPERS ────────────────────────────────────────────
const charts={};
function makeChart(id,config){if(charts[id])charts[id].destroy();charts[id]=new Chart(G(id),config);}
const gridC='rgba(51,65,85,0.5)',tickC='#94A3B8';
const baseOpts={responsive:true,maintainAspectRatio:false,
  plugins:{legend:{labels:{color:tickC,font:{family:'DM Sans',size:12},boxWidth:12}},tooltip:{backgroundColor:'#1E293B',borderColor:'#334155',borderWidth:1,titleColor:'#F1F5F9',bodyColor:'#94A3B8'}},
  scales:{x:{grid:{color:gridC},ticks:{color:tickC,font:{family:'DM Mono',size:11}}},y:{grid:{color:gridC},ticks:{color:tickC,font:{family:'DM Mono',size:11}}}}};

function switchTab(id,btn){
  document.querySelectorAll('.calc-page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
  G(`page-${id}`).classList.add('active'); btn.classList.add('active');
  if(id==='saved')loadSaved();
  if(id==='compare')populateCompareSelects();
  setTimeout(()=>{if(id==='mortgage')calcMortgage();if(id==='vehicle')calcVehicle();if(id==='personal')calcPersonal();if(id==='savings')calcSavings();},50);
}

// ─── FINANCIAL MATH ──────────────────────────────────────────
function syncSlider(a,b){G(b).value=parseFloat(G(a).value)||0;}
function syncInput(a,b){G(b).value=G(a).value;}
function pmt(p,r,n){if(!r)return p/n;const m=r/100/12;return(p*m*Math.pow(1+m,n))/(Math.pow(1+m,n)-1);}
function amort(p,r,n){const m=r/100/12;let b=p;const pm=pmt(p,r,n);return Array.from({length:n},(_,i)=>{const int=b*m,pr=pm-int;b=Math.max(0,b-pr);return{month:i+1,interest:int,principal:pr,balance:b};});}
const fmt=(n,d=0)=>new Intl.NumberFormat('en-FJ',{style:'currency',currency:'FJD',maximumFractionDigits:d}).format(n);
const fmtK=n=>n>=1e6?`$${(n/1e6).toFixed(1)}M`:`$${(n/1000).toFixed(0)}k`;

// ─── CALCULATORS ──────────────────────────────────────────────
function calcMortgage(){
  const price=v('m-price'),dp=v('m-down'),rate=v('m-rate'),term=parseInt(G('m-term').value)||30,tax=v('m-tax'),ins=v('m-ins');
  const down=price*dp/100,loan=price-down,months=term*12;
  const pi=pmt(loan,rate,months),tot=pi+tax/12+ins/12,paid=pi*months,int=paid-loan;
  G('m-out-pi').textContent=fmt(pi);G('m-out-total').textContent=fmt(tot);
  G('m-out-loan').textContent=fmt(loan);G('m-out-interest').textContent=fmt(int);G('m-out-cost').textContent=fmt(paid+down);
  G('m-analysis').innerHTML=`With a <strong>${dp}% down payment</strong> (${fmt(down)}), you borrow <strong>${fmt(loan)}</strong>. Over ${term} years at ${rate}%, you'll pay <strong>${fmt(int)}</strong> in interest (~<strong>${((int/loan)*100).toFixed(0)}%</strong> of loan). Total monthly incl. tax &amp; insurance: <strong>${fmt(tot)}</strong>.`;
  const sch=amort(loan,rate,months),labels=[],iD=[],pD=[];
  for(let y=1;y<=term;y++){const sl=sch.slice((y-1)*12,y*12);labels.push(`Yr ${y}`);iD.push(Math.round(sl.reduce((s,r)=>s+r.interest,0)));pD.push(Math.round(sl.reduce((s,r)=>s+r.principal,0)));}
  makeChart('chart-mortgage',{type:'bar',data:{labels,datasets:[{label:'Interest',data:iD,backgroundColor:'rgba(245,158,11,0.7)',borderColor:'#F59E0B',borderWidth:1,borderRadius:3},{label:'Principal',data:pD,backgroundColor:'rgba(79,70,229,0.7)',borderColor:'#4F46E5',borderWidth:1,borderRadius:3}]},options:{...baseOpts,scales:{...baseOpts.scales,y:{...baseOpts.scales.y,ticks:{...baseOpts.scales.y.ticks,callback:n=>fmtK(n)}}}}});
}
function calcVehicle(){
  const price=v('v-price'),ti=v('v-tradein'),dn=v('v-down'),tr=v('v-tax'),rate=v('v-rate'),term=parseInt(G('v-term').value)||60;
  const tax=(price-ti)*tr/100,loan=Math.max(0,price-ti-dn+tax),mo=pmt(loan,rate,term),tInt=mo*term-loan;
  G('v-out-monthly').textContent=fmt(mo);G('v-out-loan').textContent=fmt(loan);G('v-out-tax').textContent=fmt(tax);G('v-out-interest').textContent=fmt(Math.max(0,tInt));
  G('v-analysis').innerHTML=`After trade-in and down payment of <strong>${fmt(dn)}</strong>, you're financing <strong>${fmt(loan)}</strong> (incl. tax). Monthly: <strong>${fmt(mo)}</strong> for ${term} months. Total interest: <strong>${fmt(Math.max(0,tInt))}</strong>.`;
  const sch=amort(loan,rate,term),step=Math.max(1,Math.floor(term/20)),labels=[],bD=[];
  sch.filter((_,i)=>i%step===0||i===term-1).forEach(r=>{labels.push(`M${r.month}`);bD.push(Math.round(r.balance));});
  makeChart('chart-vehicle',{type:'line',data:{labels,datasets:[{label:'Remaining Balance',data:bD,borderColor:'#10B981',backgroundColor:'rgba(16,185,129,0.1)',fill:true,tension:0.4,pointRadius:2,borderWidth:2.5}]},options:{...baseOpts,scales:{...baseOpts.scales,y:{...baseOpts.scales.y,ticks:{...baseOpts.scales.y.ticks,callback:n=>fmtK(n)}}}}});
}
function calcPersonal(){
  const amt=v('p-amount'),rate=v('p-rate'),term=parseInt(G('p-term').value)||36;
  const mo=pmt(amt,rate,term),total=mo*term,int=total-amt,pct=(int/amt)*100;
  G('p-out-monthly').textContent=fmt(mo);G('p-out-interest').textContent=fmt(int);G('p-out-total').textContent=fmt(total);G('p-out-pct').textContent=`${pct.toFixed(1)}%`;G('p-out-bar').style.width=`${Math.min(100,pct).toFixed(1)}%`;
  G('p-analysis').innerHTML=`Borrowing <strong>${fmt(amt)}</strong> over ${term} months at ${rate}%, monthly payment is <strong>${fmt(mo)}</strong>. Total interest: <strong>${fmt(int)}</strong>. Total repayment: <strong>${fmt(total)}</strong>.`;
  const sch=amort(amt,rate,term);
  makeChart('chart-personal',{type:'bar',data:{labels:sch.map(r=>r.month),datasets:[{label:'Principal',data:sch.map(r=>Math.round(r.principal)),backgroundColor:'rgba(79,70,229,0.8)',borderRadius:2,stack:'a'},{label:'Interest',data:sch.map(r=>Math.round(r.interest)),backgroundColor:'rgba(245,158,11,0.7)',borderRadius:2,stack:'a'}]},options:{...baseOpts,scales:{...baseOpts.scales,x:{...baseOpts.scales.x,stacked:true},y:{...baseOpts.scales.y,stacked:true,ticks:{...baseOpts.scales.y.ticks,callback:n=>`$${n}`}}}}});
  G('p-table').innerHTML=sch.map(r=>`<tr><td style="color:var(--muted)">${r.month}</td><td>${fmt(mo)}</td><td class="col-principal">${fmt(r.principal)}</td><td class="col-interest">${fmt(r.interest)}</td><td>${fmt(r.balance)}</td></tr>`).join('');
}
let savingsFreq='monthly';
function setFreq(f){savingsFreq=f;G('freq-monthly').classList.toggle('active',f==='monthly');G('freq-annually').classList.toggle('active',f==='annually');calcSavings();}
function calcSavings(){
  const ini=v('s-initial'),mo=v('s-monthly'),rate=v('s-rate'),years=parseInt(G('s-years').value)||20,n=savingsFreq==='monthly'?12:1,r=rate/100;
  const labels=['Now'],bD=[Math.round(ini)],cD=[Math.round(ini)];
  let bal=ini,tc=ini;
  for(let y=1;y<=years;y++){for(let p=0;p<n;p++){bal=bal*(1+r/n)+mo*(12/n);tc+=mo*(12/n);}labels.push(`Yr ${y}`);bD.push(Math.round(bal));cD.push(Math.round(tc));}
  const fb=bD[bD.length-1],fc=cD[cD.length-1],gr=fb-fc;
  G('s-out-final').textContent=fmt(fb);G('s-out-contrib').textContent=fmt(fc);G('s-out-growth').textContent=fmt(Math.max(0,gr));
  G('s-analysis').innerHTML=`Starting with <strong>${fmt(ini)}</strong> + <strong>${fmt(mo)}/mo</strong> for ${years} years at ${rate}% → portfolio could reach <strong>${fmt(fb)}</strong>. That's <strong>${fmt(gr)}</strong> in pure earnings. Your money multiplied <strong>${(fb/Math.max(1,fc)).toFixed(1)}x</strong>.`;
  makeChart('chart-savings',{type:'line',data:{labels,datasets:[{label:'Portfolio Value',data:bD,borderColor:'#10B981',backgroundColor:'rgba(16,185,129,0.08)',fill:true,tension:0.4,pointRadius:2,borderWidth:2.5},{label:'Total Invested',data:cD,borderColor:'#818CF8',backgroundColor:'rgba(129,140,248,0.06)',fill:,borderDash:[5,3]}]},options:{...baseOpts,scales:{...baseOpts.scales,y:{...baseOpts.scales.y,ticks:{...baseOpts.scales.y.ticks,callback:n=>fmtK(n)}}}}});
}

// ─── PWA SERVICE WORKER ───────────────────────────────────────
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('/financenexus/sw.js').catch(e=>console.log('SW failed',e));
  });
}

// ─── PWA INSTALL PROMPT ───────────────────────────────────────
let pwaPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault(); pwaPrompt=e;
  if(!localStorage.getItem('pwa-dismissed')){
    setTimeout(()=>G('pwa-banner').classList.add('show'),3000);
  }
});
window.addEventListener('appinstalled',()=>{
  G('pwa-banner').classList.remove('show');
  toast('✅ App installed! Find it on your home screen.','success');
});
document.getElementById('pwa-install-btn').addEventListener('click',async()=>{
  if(!pwaPrompt){
    toast('📱 Tap Share → "Add to Home Screen" in your browser menu','success');
    setTimeout(()=>G('pwa-banner').classList.remove('show'),4000);
    return;
  }
  pwaPrompt.prompt();
  const{outcome}=await pwaPrompt.userChoice;
  pwaPrompt=null;
  G('pwa-banner').classList.remove('show');
});
function dismissPWA(){
  G('pwa-banner').classList.remove('show');
  localStorage.setItem('pwa-dismissed','1');
}

// ─── DYNAMIC RATES LOADING ────────────────────────────────────
async function loadLiveRates(){
  try{
    const{data,error}=await sb.from('site_config').select('data').eq('id','rates_and_news').single();
    if(error||!data)return;
    const d=data.data;
    if(d.rbf_rate){
      document.querySelectorAll('.rbf-rate').forEach(el=>el.textContent=d.rbf_rate+'%');
      document.querySelectorAll('.rbf-sub').forEach(el=>el.textContent=`p.a. — ${d.rbf_period||''} · Reserve Bank of Fiji`);
    }
    if(d.banks) renderLiveBankRates(d.banks);
    if(d.news) renderLiveNews(d.news);
  }catch(e){console.log('Rates load skipped');}
}
function renderLiveBankRates(banks){
  const sidebar=document.querySelector('.news-sidebar');
  if(sidebar){
    const bankSection=sidebar.querySelector('.news-section:nth-child(2)');
    if(bankSection){
      const header=bankSection.querySelector('.news-section-header').outerHTML;
      bankSection.innerHTML=header+banks.map(b=>`<a class="bank-card" href="${b.url||'#'}" target="_blank"><div class="bank-card-header"><span class="bank-name">${b.name}</span><span class="bank-badge">${b.updated||'2025'}</span></div>${(b.rates||[]).map(r=>`<div class="rate-row"><span class="rate-label">${r.label}</span><span class="rate-value">${r.value}</span></div>`).join('')}<span class="bank-link">→ ${(b.url||'').replace('https://','').replace('www.','')}</span></a>`).join('');
    }
  }
  const ratesGrid=document.querySelector('.rates-page-grid');
  if(ratesGrid){
    ratesGrid.innerHTML=banks.map(b=>`<a class="rates-bank-card" href="${b.url||'#'}" target="_blank"><div class="rates-bank-header"><div class="rates-bank-logo" style="background:${b.color||'linear-gradient(135deg,#4F46E5,#818CF8)'}">${b.code||b.name.substring(0,3).toUpperCase()}</div><div><div class="rates-bank-name">${b.name}</div><div class="rates-bank-updated">Updated ${b.updated||'2025'}</div></div><span class="bank-badge">CURRENT</span></div>${(b.rates||[]).map(r=>`<div class="rates-row"><span>${r.label}</span><span class="rates-val">${r.value}</span></div>`).join('')}<div class="rates-bank-link">Visit ${(b.url||'').replace('https://','').replace('www.','')} →</div></a>`).join('');
  }
}
function renderLiveNews(news){
  const ratesNewsGrid=document.querySelector('.rates-news-grid');
  if(ratesNewsGrid){
    ratesNewsGrid.innerHTML=news.map(n=>`<a class="rates-news-card" href="${n.url||'#'}" target="_blank"><span class="news-tag tag-${n.tag||'mortgage'}">${(n.tag||'news').charAt(0).toUpperCase()+(n.tag||'news').slice(1)}</span><div class="rates-news-headline">${n.headline}</div><div class="news-meta"><span class="news-source">${n.source}</span> · ${n.date}</div></a>`).join('');
  }
  const sidebar=document.querySelector('.news-sidebar');
  if(sidebar){
    const newsSection=sidebar.querySelector('.news-section:nth-child(3)');
    if(newsSection){
      const header=newsSection.querySelector('.news-section-header').outerHTML;
      newsSection.innerHTML=header+news.slice(0,5).map(n=>`<a class="news-item" href="${n.url||'#'}" target="_blank"><span class="news-tag tag-${n.tag||'mortgage'}">${(n.tag||'news').charAt(0).toUpperCase()+(n.tag||'news').slice(1)}</span><div class="news-headline">${n.headline}</div><div class="news-meta"><span class="news-source">${n.source}</span> · ${n.date}</div></a>`).join('');
    }
  }
}

// ─── ADMIN PANEL ─────────────────────────────────────────────
const ADMIN_PASSWORD='financenexus2026';
let adminUnlocked=false;
function openAdmin(){
  G('admin-panel').classList.add('open');
  if(!adminUnlocked){G('admin-login-gate').style.display='block';G('admin-content').style.display='none';setTimeout(()=>G('admin-pw-input').focus(),100);}
}
function closeAdmin(){G('admin-panel').classList.remove('open');}
function checkAdminPW(){
  const pw=G('admin-pw-input').value,msg=G('admin-pw-msg');
  if(pw===ADMIN_PASSWORD){adminUnlocked=true;G('admin-login-gate').style.display='none';G('admin-content').style.display='block';loadAdminData();}
  else{msg.className='admin-msg error';msg.textContent='Incorrect password.';msg.style.display='block';G('admin-pw-input').value='';setTimeout(()=>msg.style.display='none',2500);}
}
const defaultBanks=[
  {name:'ANZ Fiji',code:'ANZ',color:'linear-gradient(135deg,#005f9e,#0085c8)',url:'https://www.anz.com/fiji/en/interest-rates/',updated:'Dec 2025',rates:[{label:'🏠 Home (Variable)',value:'6.49%'},{label:'🏠 Home (1yr Fixed)',value:'3.95%'},{label:'🚗 Car Loan',value:'8.45%'},{label:'💳 Personal (Secured)',value:'10.50%'},{label:'💳 Personal (Unsecured)',value:'16.50%'}]},
  {name:'Westpac Fiji',code:'WBC',color:'linear-gradient(135deg,#c7001a,#e8001e)',url:'https://www.westpac.com.fj/',updated:'Jan 2026',rates:[{label:'🏠 Home (Variable)',value:'7.49%'},{label:'🏠 Home (1yr Fixed)',value:'4.75%'},{label:'🚗 Vehicle (1yr Fixed)',value:'4.75%'},{label:'💳 Personal (Secured)',value:'10.45%'}]},
  {name:'BSP Fiji',code:'BSP',color:'linear-gradient(135deg,#004a8f,#0066cc)',url:'https://www.bsp.com.fj/',updated:'2025',rates:[{label:'🏠 Home (1yr Fixed)',value:'4.10%'},{label:'🏠 Home (2yr Fixed)',value:'4.90%'},{label:'🚗 Motor Vehicle',value:'Contact BSP'}]},
  {name:'HFC Bank',code:'HFC',color:'linear-gradient(135deg,#006644,#009966)',url:'https://www.hfc.com.fj/',updated:'2025',rates:[{label:'🏠 Dream Home Package',value:'Competitive'},{label:'🚗 Motor Vehicle',value:'Contact HFC'}]},
  {name:'FDB',code:'FDB',color:'linear-gradient(135deg,#7c3aed,#a855f7)',url:'https://www.fdb.com.fj/',updated:'2025',rates:[{label:'🏠 Choice Home Loan',value:'from 3.99%'},{label:'👤 Youth/Women/Rural',value:'✓ Priority'}]},
];
const defaultNews=[
  {tag:'mortgage',headline:'FDB launches Choice Home Loan from 3.99%',source:'FBC News',date:'2025',url:'https://www.fbcnews.com.fj/'},
  {tag:'mortgage',headline:'Merchant Finance launches zero-deposit home loan',source:'Fijivillage',date:'2025',url:'https://www.fijivillage.com/'},
  {tag:'vehicle',headline:'ANZ Fiji car loan at 8.45% p.a.',source:'ANZ Fiji',date:'Dec 2025',url:'https://www.anz.com/fiji/en/interest-rates/'},
  {tag:'vehicle',headline:'Westpac vehicle 1-yr fixed drops to 4.75%',source:'Westpac Fiji',date:'Jan 2026',url:'https://www.westpac.com.fj/'},
  {tag:'personal',headline:'ANZ personal: secured 10.50%, unsecured 16.50%',source:'ANZ Fiji',date:'Dec 2025',url:'https://www.anz.com/fiji/en/interest-rates/'},
];
let adminData={rbf_rate:'1.67',rbf_period:'Q1 2025',banks:defaultBanks,news:defaultNews};
async function loadAdminData(){
  try{const{data}=await sb.from('site_config').select('data').eq('id','rates_and_news').single();if(data?.data)adminData={...adminData,...data.data};}catch(e){}
  renderAdminForm();
}
function renderAdminForm(){
  G('adm-rbf-rate').value=adminData.rbf_rate||'1.67';
  G('adm-rbf-period').value=adminData.rbf_period||'Q1 2025';
  renderAdminBanks(); renderAdminNews();
}
function renderAdminBanks(){
  G('admin-banks-container').innerHTML=(adminData.banks||defaultBanks).map((b,bi)=>`<div class="admin-bank-card"><div class="admin-bank-name">${b.code||'🏛️'} ${b.name}</div><div class="admin-grid" style="margin-bottom:10px"><div class="admin-field"><label class="admin-label">Updated Label</label><input class="admin-input" value="${b.updated||''}" oninput="adminData.banks[${bi}].updated=this.value" placeholder="e.g. Jan 2026"/></div><div class="admin-field"><label class="admin-label">Website URL</label><input class="admin-input" value="${b.url||''}" oninput="adminData.banks[${bi}].url=this.value" placeholder="https://..."/></div></div>${(b.rates||[]).map((r,ri)=>`<div class="admin-grid" style="margin-bottom:8px"><div class="admin-field"><input class="admin-input" value="${r.label||''}" oninput="adminData.banks[${bi}].rates[${ri}].label=this.value" placeholder="Rate label"/></div><div class="admin-field" style="display:flex;gap:6px"><input class="admin-input rate" value="${r.value||''}" oninput="adminData.banks[${bi}].rates[${ri}].value=this.value" placeholder="e.g. 6.49%" style="flex:1"/><button onclick="removeRate(${bi},${ri})" style="padding:8px 10px;background:rgba(239,68,68,0.15);border:none;color:#FCA5A5;border-radius:7px;cursor:pointer;font-size:13px">✕</button></div></div>`).join('')}<button class="admin-add-btn" onclick="addRate(${bi})">+ Add Rate Row</button></div>`).join('');
}
function addRate(bi){adminData.banks[bi].rates.push({label:'',value:''});renderAdminBanks();}
function removeRate(bi,ri){adminData.banks[bi].rates.splice(ri,1);renderAdminBanks();}
function renderAdminNews(){
  G('admin-news-container').innerHTML=(adminData.news||[]).map((n,ni)=>`<div class="admin-news-item"><button class="admin-news-remove" onclick="removeNewsItem(${ni})">✕ Remove</button><div class="admin-grid"><div class="admin-field"><label class="admin-label">Tag</label><select class="admin-input" onchange="adminData.news[${ni}].tag=this.value">${['mortgage','vehicle','personal','policy','savings'].map(t=>`<option value="${t}" ${n.tag===t?'selected':''}>${t}</option>`).join('')}</select></div><div class="admin-field"><label class="admin-label">Date</label><input class="admin-input" value="${n.date||''}" oninput="adminData.news[${ni}].date=this.value" placeholder="e.g. Feb 2026"/></div><div class="admin-field full"><label class="admin-label">Headline</label><input class="admin-input" value="${n.headline||''}" oninput="adminData.news[${ni}].headline=this.value" placeholder="News headline..."/></div><div class="admin-field"><label class="admin-label">Source</label><input class="admin-input" value="${n.source||''}" oninput="adminData.news[${ni}].source=this.value" placeholder="Source name"/></div><div class="admin-field"><label class="admin-label">URL</label><input class="admin-input" value="${n.url||''}" oninput="adminData.news[${ni}].url=this.value" placeholder="https://..."/></div></div></div>`).join('');
}
function addNewsItem(){if((adminData.news||[]).length>=8){toast('Maximum 8 news items.','error');return;}adminData.news.push({tag:'mortgage',headline:'',source:'',date:'',url:''});renderAdminNews();}
function removeNewsItem(idx){adminData.news.splice(idx,1);renderAdminNews();}
async function saveAdminData(){
  const btn=G('admin-save-btn'),msg=G('admin-msg');
  adminData.rbf_rate=G('adm-rbf-rate').value;
  adminData.rbf_period=G('adm-rbf-period').value;
  btn.disabled=true;btn.textContent='Saving…';msg.style.display='none';
  try{
    const{error}=await sb.from('site_config').upsert({id:'rates_and_news',data:adminData,updated_at:new Date().toISOString()});
    if(error)throw error;
    btn.disabled=false;btn.textContent='💾 Save All Changes → Goes Live Now';
    msg.className='admin-msg success';msg.textContent='✅ All changes saved! Rates & news updated live for all users.';msg.style.display='block';
    renderLiveBankRates(adminData.banks);renderLiveNews(adminData.news);
    document.querySelectorAll('.rbf-rate').forEach(el=>el.textContent=adminData.rbf_rate+'%');
    document.querySelectorAll('.rbf-sub').forEach(el=>el.textContent=`p.a. — ${adminData.rbf_period} · Reserve Bank of Fiji`);
    toast('✅ Rates & news updated live!','success');
    setTimeout(()=>msg.style.display='none',5000);
  }catch(e){
    btn.disabled=false;btn.textContent='💾 Save All Changes → Goes Live Now';
    msg.className='admin-msg error';msg.textContent='Error: '+e.message;msg.style.display='block';
  }
}
