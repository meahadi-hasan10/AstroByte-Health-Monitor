'use strict';
const assert=require('node:assert/strict');
const E=require('../engine.js');
const baseline={...E.BASELINE};
assert.equal(E.evaluate(baseline).status,'Stable');
assert.equal(E.evaluate(baseline).risk,11);
assert.equal(E.evaluate(E.SCENARIOS.combined.values).status,'Elevated');
assert.equal(E.evaluate(E.SCENARIOS.combined.values).risk,91);
assert.equal(E.evaluate(E.SCENARIOS.nominal.values).risk,11);
for(const [name,scenario] of Object.entries(E.SCENARIOS)){
 assert.ok(E.evaluate(scenario.values).risk>=0&&E.evaluate(scenario.values).risk<=100,`${name} in range`);
 assert.ok(E.localInsight(scenario.values).includes('not'),`${name} includes caution`);
 assert.equal(E.trend(scenario.values).length,24);
}
assert.throws(()=>E.validate({...baseline,hr:NaN}),/Invalid/);
assert.throws(()=>E.validate({...baseline,spo2:101}),/Invalid/);
assert.throws(()=>E.validate({...baseline,radiation:'bad'}),/Invalid/);
assert.ok(E.findings(E.SCENARIOS.combined.values).length>=4);
const csv=E.historyCSV([{timestamp:'2026-10-08',scenario:'a,"test"',...baseline,risk:11,status:'Stable'}]);
assert.ok(csv.includes('"a,""test"""'));
assert.equal(csv.split('\r\n').length,3);
console.log('PASS: 15+ engine validations, scenarios, scores, insights, trends, CSV escaping');
