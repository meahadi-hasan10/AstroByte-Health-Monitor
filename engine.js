/* Team AstroByte */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AstroEngine = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const BASELINE = Object.freeze({hr:72,spo2:98,temp:36.6,sleep:7.1,fatigue:28,radiation:1.4});
  const RANGES = Object.freeze({hr:[45,140],spo2:[85,100],temp:[34,40],sleep:[2,10],fatigue:[0,100],radiation:[0,12]});
  const SCENARIOS = Object.freeze({
    nominal: {label:'Nominal', values: {...BASELINE}},
    fatigue: {label:'Fatigue & recovery', values:{hr:87,spo2:97,temp:36.8,sleep:3.9,fatigue:84,radiation:1.4}},
    oxygen: {label:'Low oxygen', values:{hr:116,spo2:89,temp:36.9,sleep:6.6,fatigue:53,radiation:1.4}},
    radiation: {label:'Radiation context', values:{hr:78,spo2:98,temp:36.6,sleep:7.1,fatigue:31,radiation:9.5}},
    combined: {label:'Multi-signal alert', values:{hr:116,spo2:91,temp:38.1,sleep:4.1,fatigue:83,radiation:6.3}}
  });
  const LABELS={hr:'Heart rate',spo2:'Oxygen saturation',temp:'Temperature',sleep:'Sleep duration',fatigue:'Fatigue index',radiation:'Radiation context'};
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  function validate(data) {
    if (!data || typeof data !== 'object') throw new Error('Telemetry must be an object');
    const cleaned={};
    for (const [key,[lo,hi]] of Object.entries(RANGES)) {
      const value=Number(data[key]);
      if (!Number.isFinite(value) || value<lo || value>hi) throw new Error(`Invalid ${key}: expected ${lo}–${hi}`);
      cleaned[key]=value;
    }
    return cleaned;
  }
  function metricScore(name,v){
    switch(name){
      case 'hr':return v<42||v>125?95:v<50||v>105?58:12;
      case 'spo2':return v<90?96:v<94?62:8;
      case 'temp':return v<34.8||v>38.6?90:v<35.4||v>37.7?55:10;
      case 'sleep':return v<4.5?80:v<6?48:12;
      case 'fatigue':return v>78?88:v>55?54:clamp(v*.55,5,45);
      case 'radiation':return v>8?90:v>4?58:clamp(v*7,4,38);
      default:return 0;
    }
  }
  function evaluate(raw){
    const v=validate(raw);
    const scores=Object.fromEntries(Object.entries(v).map(([k,x])=>[k,Math.round(metricScore(k,x))]));
    const weighted=scores.hr*.20+scores.spo2*.22+scores.temp*.14+scores.sleep*.12+scores.fatigue*.16+scores.radiation*.16;
    let combination=0;
    if(v.sleep<5.5&&v.fatigue>60)combination+=9;
    if(v.spo2<94&&v.hr>105)combination+=10;
    if(v.radiation>4&&v.fatigue>55)combination+=6;
    const risk=Math.round(clamp(weighted+combination,0,100));
    return {scores,risk,status:risk<35?'Stable':risk<65?'Watch':'Elevated',combination};
  }
  function findings(raw){
    const v=validate(raw), result=[];
    const push=(key, detail, action)=>result.push({key,label:LABELS[key],detail,action});
    if(v.spo2<94)push('spo2',`SpO₂ is ${v.spo2.toFixed(0)}%.`,'Recheck sensor fit and repeat the reading.');
    if(v.hr<50||v.hr>105)push('hr',`Heart rate is ${v.hr.toFixed(0)} bpm.`,'Compare with workload and personal baseline.');
    if(v.temp<35.4||v.temp>37.7)push('temp',`Temperature is ${v.temp.toFixed(1)} °C.`,'Repeat the measurement and review symptoms.');
    if(v.sleep<6)push('sleep',`Sleep duration is ${v.sleep.toFixed(1)} hours.`,'Review recovery, sleep routine and duty schedule.');
    if(v.fatigue>55)push('fatigue',`Fatigue index is ${v.fatigue.toFixed(0)}/100.`,'Consider monitoring performance and nonessential workload.');
    if(v.radiation>4)push('radiation',`Illustrative radiation level is ${v.radiation.toFixed(1)} µGy/h.`,'Consult approved mission radiation guidance and telemetry.');
    return result;
  }
  function localInsight(raw){
    const result=evaluate(raw), items=findings(raw);
    const header=`Prototype status: ${result.status} · illustrative risk index ${result.risk}/100.`;
    if(!items.length)return `${header} All simulated indicators are within the selected demo reference bands. Continue observing trends and cross-check instrument readings. This is non-clinical decision support, not medical advice.`;
    return `${header} Flagged patterns: ${items.map(x=>x.detail).join(' ')} Suggested follow-up: ${items.map(x=>x.action).join(' ')} Verify measurements and follow qualified mission medical procedures. This is not a diagnosis.`;
  }
  function trend(raw){
    const {risk}=evaluate(raw); const base=84-risk*.19;
    return Array.from({length:24},(_,i)=>Number(clamp(base+Math.sin(i*.55)*3.6+Math.cos(i*.23)*2.1+(i>18?risk*.04:0),35,98).toFixed(2)));
  }
  function csvEscape(value){const x=String(value??'');return /[",\r\n]/.test(x)?`"${x.replace(/"/g,'""')}"`:x;}
  function historyCSV(records){
    const cols=['timestamp','scenario','hr','spo2','temp','sleep','fatigue','radiation','risk','status'];
    return [cols.join(','),...records.map(row=>cols.map(k=>csvEscape(row[k])).join(','))].join('\r\n')+'\r\n';
  }
  return {BASELINE,RANGES,SCENARIOS,LABELS,clamp,validate,evaluate,findings,localInsight,trend,historyCSV};
});
