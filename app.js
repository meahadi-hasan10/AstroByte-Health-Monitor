/* AstroByte Health Monitor */
(() => {
  'use strict';
  const E = window.AstroEngine;
  const $ = id => document.getElementById(id);
  let state = {...E.BASELINE};
  let activeScenario = 'nominal';
  let records = [];
  let latestNasa = null;
  let toastTimer;
  let requestVersion=0;
  let lastMode='local';
  const sliderMap={hr:['hrSlider','hrOut'],spo2:['spo2Slider','spo2Out'],temp:['tempSlider','tempOut'],sleep:['sleepSlider','sleepOut'],fatigue:['fatigueSlider','fatigueOut'],radiation:['radSlider','radOut']};
  const format=(k,v) => ['temp','sleep','radiation'].includes(k)?Number(v).toFixed(1):Number(v).toFixed(0);

  function showToast(msg){
    const node=$('toast');node.textContent=msg;node.classList.add('show');clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>node.classList.remove('show'),2900);
  }
  function scrollTo(id){const el=$(id); if(el)el.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}
  function syncSliders(){for(const [key,[slider,out]] of Object.entries(sliderMap)){$(slider).value=state[key];$(out).textContent=format(key,state[key]);}}
  function buildRiskBars(scores){
    const node=$('riskBars'); node.replaceChildren();
    for(const [key,score] of Object.entries(scores)){
      const row=document.createElement('div');row.className='risk-row';
      const label=document.createElement('span');label.textContent=E.LABELS[key];
      const track=document.createElement('div');track.className='risk-track';
      const bar=document.createElement('div');bar.className='risk-fill';bar.style.width=`${score}%`;track.appendChild(bar);
      const val=document.createElement('b');val.textContent=score;
      row.append(label,track,val);node.appendChild(row);
    }
  }
  function drawTrend(){
    const canvas=$('trendChart'); if(!canvas)return;
    const r=canvas.getBoundingClientRect();if(!r.width)return;
    const scale=Math.min(window.devicePixelRatio||1,2); const width=r.width,height=230;
    canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
    const ctx=canvas.getContext('2d');ctx.setTransform(scale,0,0,scale,0,0);
    ctx.clearRect(0,0,width,height);
    ctx.lineWidth=1;ctx.strokeStyle='rgba(155,198,250,.14)';
    for(let y=26;y<height-15;y+=42){ctx.beginPath();ctx.moveTo(12,y);ctx.lineTo(width-12,y);ctx.stroke();}
    const values=E.trend(state),pad=17;
    const x=i=>pad+i*(width-2*pad)/(values.length-1),y=v=>height-pad-(v-35)*(height-2*pad)/65;
    const fill=ctx.createLinearGradient(0,12,0,height);fill.addColorStop(0,'rgba(51,216,255,.27)');fill.addColorStop(1,'rgba(50,110,250,0)');
    ctx.beginPath();values.forEach((n,i)=>i?ctx.lineTo(x(i),y(n)):ctx.moveTo(x(i),y(n)));
    ctx.lineTo(x(23),height-pad);ctx.lineTo(x(0),height-pad);ctx.closePath();ctx.fillStyle=fill;ctx.fill();
    const grad=ctx.createLinearGradient(0,0,width,0);grad.addColorStop(0,'#35d8ff');grad.addColorStop(1,'#7d8aff');
    ctx.strokeStyle=grad;ctx.lineWidth=3;ctx.lineJoin='round';ctx.beginPath();values.forEach((n,i)=>i?ctx.lineTo(x(i),y(n)):ctx.moveTo(x(i),y(n)));ctx.stroke();
    ctx.fillStyle='#a9c7e5';ctx.font='11px system-ui';ctx.fillText('Illustrative history preview · not recorded telemetry',pad,16);
  }
  function renderAlert(risk, findings){
    const box=$('alertBox');box.className='alert-box '+(risk<35?'':risk<65?'warn':'danger');box.replaceChildren();
    const title=document.createElement('strong');const detail=document.createElement('span');
    title.textContent=risk<35?'No notable demo alerts':risk<65?'Review selected indicators':'Elevated multi-signal pattern';
    detail.textContent=findings.length?findings.slice(0,2).map(f=>f.detail).join(' '):'Keep monitoring. Values are synthetic, not live medical readings.';
    box.append(title,detail);
  }
  function updateDashboard(){
    ++requestVersion; 
    const {scores,risk,status}=E.evaluate(state);
    for(const [k,id] of Object.entries({hr:'hrValue',spo2:'spo2Value',temp:'tempValue',sleep:'sleepValue',fatigue:'fatigueValue',radiation:'radiationValue'}))$(id).textContent=format(k,state[k]);
    $('heroHr').textContent=format('hr',state.hr);$('heroSpo2').textContent=format('spo2',state.spo2);$('heroRisk').textContent=risk;
    $('riskScore').textContent=risk;$('riskRing').style.setProperty('--risk',risk);
    $('riskRing').style.background=`conic-gradient(${risk<35?'var(--green)':risk<65?'var(--yellow)':'var(--red)'} ${risk}%,rgba(255,255,255,.08) 0)`;
    const pill=$('overallStatus');pill.textContent=status;pill.className='status-pill '+(risk<35?'good':risk<65?'warn':'danger');
    const trendLabels={sleepTrend:[state.sleep<4.5?'Very low':state.sleep<6?'Below demo target':'In demo band',state.sleep<4.5?'danger':state.sleep<6?'warn':'good'],
      fatigueTrend:[state.fatigue>78?'High':state.fatigue>55?'Moderate':'Low',state.fatigue>78?'danger':state.fatigue>55?'warn':'good'],
      radiationTrend:[state.radiation>8?'High demo level':state.radiation>4?'Watch demo level':'Simulated',state.radiation>8?'danger':state.radiation>4?'warn':'']};
    for(const [id,[label,klass]] of Object.entries(trendLabels)){$(id).textContent=label;$(id).className=`mini-trend ${klass}`;}
    buildRiskBars(scores);renderAlert(risk,E.findings(state));drawTrend();
    const s=$('lastComputed');if(s)s.textContent='Updated from synthetic telemetry · '+new Date().toLocaleTimeString();
  }
  function logSnapshot(reason){
    const result=E.evaluate(state);
    records.push({timestamp:new Date().toISOString(),scenario:reason,...state,risk:result.risk,status:result.status});
    if(records.length>80)records=records.slice(-80);
    renderHistory();
  }
  function renderHistory(){
    $('historyCount').textContent=`${records.length} session snapshot${records.length===1?'':'s'}`;
    const holder=$('historyList');holder.replaceChildren();
    for(const entry of records.slice(-5).reverse()){
      const item=document.createElement('div');item.className='history-item';
      const left=document.createElement('span');left.textContent=`${new Date(entry.timestamp).toLocaleTimeString()} · ${entry.scenario}`;
      const right=document.createElement('strong');right.textContent=`${entry.status} · ${entry.risk}/100`;
      item.append(left,right);holder.appendChild(item);
    }
    $('exportCsvBtn').disabled=!records.length;
    $('clearHistoryBtn').disabled=records.length===0;
  }
  function switchScenario(name, {scroll=false}={}){
    const preset=E.SCENARIOS[name];if(!preset)return;
    state={...preset.values};activeScenario=name;syncSliders();updateDashboard();
    for(const b of document.querySelectorAll('[data-scenario]')){
      const selected=b.dataset.scenario===name;b.classList.toggle('is-active',selected);b.setAttribute('aria-pressed',String(selected));
    }
    logSnapshot(preset.label);
    showToast(`${preset.label} loaded · simulated data`);
    if(scroll)scrollTo('dashboard');
  }
  function markCustom(){activeScenario='custom';for(const b of document.querySelectorAll('[data-scenario]')){b.classList.remove('is-active');b.setAttribute('aria-pressed','false');}}
  function updateInsightDisplay(text, mode){
    
    $('aiMessage').textContent = text; $('aiMode').textContent = mode === 'llm' ? 'AI-generated health insight' : 'Rule-based health insight'; lastMode = mode;
    $('analysisText').textContent=text;
    $('analysisPanel').hidden=false;
    $('insightSource').textContent=mode==='llm'?'Optional LLM service':'Transparent local rule engine';
  }
  async function generateAI({fromRisk=false}={}){
    const version=++requestVersion;
    const snapshot={...state};
    const buttons=[$('aiSummaryBtn'),$('analyzeBtn')];
    for(const btn of buttons){btn.disabled=true;btn.dataset.label||=(btn.textContent||'');btn.textContent='Analyzing…';}
    let text=E.localInsight(snapshot),mode='local';
    try {
      if(location.protocol!=='file:'){
        const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),5000);
        try{
          const response=await fetch('/api/ai-summary',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(snapshot),signal:controller.signal});
          if(response.ok){const data=await response.json();if(typeof data.summary==='string'&&data.summary.trim()){
            text=data.summary.trim();mode=data.mode==='llm'?'llm':'local';
          }}
        }finally{clearTimeout(timer);}
      }
    }catch(err){}
    if(version===requestVersion){
      updateInsightDisplay(text,mode);logSnapshot('Health analyzed');
      if(fromRisk)scrollTo('analysisPanel');
      showToast(mode==='llm'?'LLM insight generated':'Local explainable insight ready');
    }
    for(const btn of buttons){btn.disabled=false;btn.textContent=btn.dataset.label;}
  }
  function downloadFile(filename, text, type){
    const blob=new Blob([text],{type}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=filename;a.style.display='none';document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  async function copyInsight(){
    const text=$('aiMessage').textContent.trim();
    if(!text){showToast('No insight to copy');return;}
    try{
      if(navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else {
        const field=document.createElement('textarea');field.value=text;field.style.position='fixed';field.style.left='-9999px';document.body.appendChild(field);field.focus();field.select();
        const success=document.execCommand('copy');field.remove();if(!success)throw new Error('Copy unsupported');
      }
      showToast('Insight copied');
    }catch(e){downloadFile('astrobyte-insight.txt',text,'text/plain;charset=utf-8');showToast('Clipboard unavailable · text file downloaded');}
  }
  function exportReport(){
    const result=E.evaluate(state);
    const report={project:'AstroByte Health Monitor',version:'2.0',created_at:new Date().toISOString(),demo_only:true,
      notice:'Synthetic indicators and illustrative heuristic thresholds. Not medical or radiation dose guidance.',
      scenario:activeScenario,mission_day:142,telemetry:{...state},risk_index:result.risk,status:result.status,
      score_breakdown:result.scores,findings:E.findings(state),insight:$('aiMessage').textContent,insight_mode:lastMode,
      nasa_environmental_reference:'NASA OSDR RadLab – historical radiation measurements (optional API)',
      nasa_data_last_retrieved:latestNasa};
    downloadFile('astrobyte-health-report.json',JSON.stringify(report,null,2),'application/json');showToast('Health snapshot downloaded');
  }

    function renderNasaPreview(data) {
      $('nasaStatusTitle').textContent = 'NASA RadLab response received';
      const count = Number(data.record_count) || 0;
      const sample = data.sample || null;
      $('nasaStatusText').textContent =
        `Retrieved ${count} historical ISS radiation records. ` +
        'These are environmental measurements, not astronaut vital signs.';
      const series = Array.isArray(data.radiation_series)
        ? data.radiation_series.filter(p =>
            Number.isFinite(Number(p.dose_rate_uGy_h)))
        : [];
      const box = $('nasaResponse');
      box.innerHTML = `
        <div class="nasa-summary-heading">
          <strong>NASA Data Summary</strong>
          <span>Historical data</span>
        </div>
        <div class="nasa-summary-grid">
          <div>
            <small>Records Retrieved</small>
            <strong id="nasaRecordCount"></strong>
          </div>
          <div>
            <small>Chart Samples</small>
            <strong id="nasaSamplesCount"></strong>
          </div>
          <div>
            <small>Spacecraft</small>
            <strong>ISS</strong>
          </div>
          <div>
            <small>Instrument</small>
            <strong>DosTel</strong>
          </div>
        </div>
        <div class="nasa-summary-period">
          <small>Observation Period</small>
          <span id="nasaObservationPeriod"></span>
        </div>
        <p class="nasa-summary-source">
          Source: NASA OSDR RadLab API
        </p>
        <p class="nasa-summary-note">
          Historical environmental measurements,
          not live astronaut health data.
        </p>
      `;
      $('nasaRecordCount').textContent = count.toLocaleString();
      $('nasaSamplesCount').textContent = series.length.toLocaleString();
      $('nasaObservationPeriod').textContent =
        String(data.period || 'Historical sample')
          .replaceAll('T', ' ')
          .replace(' through ', ' – ');
      box.hidden = false;
      $('nasaChartWrap').hidden = series.length < 2;
      if (series.length >= 2) {
        drawNasaSeries(series);
      }
      latestNasa = {
        record_count: count,
        source_url: data.source_url || '',
        sample: sample,
        series_points: series.length,
        retrieved_at: new Date().toISOString()
      };
    }

  function drawNasaSeries(points){
    const canvas=$('nasaChart'),width=500,height=155,scale=Math.min(window.devicePixelRatio||1,2);
    canvas.width=width*scale;canvas.height=height*scale;const ctx=canvas.getContext('2d');
    ctx.setTransform(scale,0,0,scale,0,0);ctx.clearRect(0,0,width,height);
    const numbers=points.map(p=>Number(p.dose_rate_uGy_h));const lo=Math.min(...numbers),hi=Math.max(...numbers),span=Math.max(.0001,hi-lo);
    const pad=20,x=i=>pad+i*(width-2*pad)/Math.max(1,points.length-1),y=n=>height-pad-(n-lo)/span*(height-2*pad);
    ctx.strokeStyle='rgba(158,195,230,.12)';ctx.lineWidth=1;
    for(let i=1;i<=3;i++){const row=height/4*i;ctx.beginPath();ctx.moveTo(pad,row);ctx.lineTo(width-pad,row);ctx.stroke();}
    ctx.strokeStyle='#56e5cc';ctx.lineWidth=3;ctx.beginPath();numbers.forEach((n,i)=>i?ctx.lineTo(x(i),y(n)):ctx.moveTo(x(i),y(n)));ctx.stroke();
    ctx.fillStyle='#b1cbe2';ctx.font='11px system-ui';ctx.fillText(`${lo.toFixed(2)}–${hi.toFixed(2)} µGy/h · ${numbers.length} historical samples`,16,13);
  }
  async function loadNasa(){
    const btn=$('nasaBtn');btn.disabled=true;btn.textContent='Checking NASA…';
    try{
      if(location.protocol==='file:')throw Error('Open with Python/Flask backend to enable the live historical query.');
      const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),18000);
      let response;
      try{response=await fetch('/api/nasa/radiation',{signal:ctl.signal});}finally{clearTimeout(timer);}
      const data=await response.json();if(!response.ok||data.ok!==true)throw Error(data.error||'RadLab query unavailable');
      renderNasaPreview(data);showToast('NASA historical radiation data retrieved');
    }catch(err){
      $('nasaStatusTitle').textContent='Historical API data not loaded';
      $('nasaStatusText').textContent=`${err.message?.slice(0,165)||'Connection unavailable'}. The demonstration still uses synthetic radiation values; no NASA readings are being presented as live.`;  
      $('nasaResponse').hidden = true; $('nasaChartWrap').hidden = true; showToast('NASA data unavailable · Simulated dashboard remains active');
    }finally{btn.disabled=false;btn.textContent='Query historical NASA data';}
  }
  async function demoTour(){switchScenario('combined',{scroll:true});await generateAI({fromRisk:true});}
  function init(){
    for(const [key,[slider,out]] of Object.entries(sliderMap)){
      $(slider).addEventListener('input',e=>{state[key]=Number(e.target.value);$(out).textContent=format(key,state[key]);markCustom();updateDashboard();});
      $(slider).addEventListener('change',()=>logSnapshot(`${E.LABELS[key]} adjusted`));
    }
    for(const b of document.querySelectorAll('[data-scenario]'))b.addEventListener('click',()=>switchScenario(b.dataset.scenario,{scroll:false}));
    $('randomizeBtn').addEventListener('click',()=>{
      const names=['nominal','fatigue','oxygen','radiation','combined'];switchScenario(names[Math.floor(Math.random()*names.length)]);});
    $('resetBtn').addEventListener('click',()=>switchScenario('nominal'));
    $('tourBtn').addEventListener('click',demoTour);
    $('analyzeBtn').addEventListener('click',()=>generateAI({fromRisk:true}));
    $('aiSummaryBtn').addEventListener('click',()=>generateAI());
    $('copyInsightBtn').addEventListener('click',copyInsight);
    $('nasaBtn').addEventListener('click',loadNasa);
    $('exportReportBtn').addEventListener('click',exportReport);
    $('exportCsvBtn').addEventListener('click',()=>{downloadFile('astrobyte-session-history.csv',E.historyCSV(records),'text/csv;charset=utf-8');showToast('Session history downloaded');});
    $('clearHistoryBtn').addEventListener('click',()=>{records=[];renderHistory();showToast('Session history cleared');});
    $('themeBtn').addEventListener('click',()=>{const on=document.body.classList.toggle('high-contrast');$('themeBtn').setAttribute('aria-pressed',String(on));$('themeBtn').textContent=on?'Standard contrast':'High contrast';});
    const menu=$('mobileMenuBtn');menu.addEventListener('click',()=>{const open=$('mainNav').classList.toggle('open');menu.setAttribute('aria-expanded',String(open));});
    document.querySelectorAll('#mainNav a').forEach(a=>a.addEventListener('click',()=>{$('mainNav').classList.remove('open');menu.setAttribute('aria-expanded','false');}));
    window.addEventListener('resize',drawTrend);
    syncSliders();updateDashboard();logSnapshot('Nominal baseline');
    $('aiMessage').textContent=E.localInsight(state);
  }
  document.addEventListener('DOMContentLoaded',init);
})();
