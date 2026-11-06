'use strict';
// Local preview: serves Index.html with a google.script.run shim wired to the REAL .gs code (in-memory data).
const http = require('http'); const fs = require('fs'); const path = require('path');
const { loadApp } = require('./mock-gas');
const app = loadApp();
app.run('testEnvBegin_()');
const call = (n, o) => JSON.parse((app.ctx.__n = n, app.ctx.__j = JSON.stringify(o || {}), app.run('apiCall(__n, __j)')));
// synthetic demo data (not real family data)
const today = call('bootstrap').data.today;
call('income', { date: today, amount: 30000000, wallet_id: 'W002', category_id: 'C001' });
call('income', { date: today, amount: 12000000, wallet_id: 'W001' });
const cats = call('bootstrap').data.categories.filter(c => c.kind === 'expense');
cats.slice(0, 6).forEach((c, i) => call('expense', { date: today, amount: 150000 * (i + 2), wallet_id: i % 2 ? 'W001' : 'W002', category_id: c.category_id, paid_by: 'M01', beneficiary: 'FAMILY', note: 'Mẫu ' + (i + 1), key: 'seed' + i }));
call('transfer', { date: today, amount: 2000000, from_wallet: 'W002', to_wallet: 'W005' });
call('createAsset', { asset_type: 'car', name: 'Xe mẫu', purchase_value: 600000000, purchase_date: today });
call('createLiability', { name: 'Vay mẫu', original_amount: 400000000, opening_balance: 350000000, opening_date: '2026-11-01' });
const j = call('budget', {}).data; j.jars.forEach((x, i) => call('setBudget', { period: j.period, jar_id: x.jar_id, amount: 3000000 + i * 500000 }));
const shim = `<script>window.google={script:{run:(function(){function mk(s,f){return new Proxy({},{get:function(_,p){if(p==='withSuccessHandler')return function(h){return mk(h,f)};if(p==='withFailureHandler')return function(h){return mk(s,h)};return function(){var a=[].slice.call(arguments);fetch('/rpc',{method:'POST',body:JSON.stringify({fn:p,args:a})}).then(function(r){return r.text()}).then(function(t){s&&s(t)},function(e){f&&f(e)})}}})}return mk()})()}};</script>`;
const port = +process.argv[2] || 8765;
http.createServer((req, res) => {
  if (req.method === 'POST') {
    let b = ''; req.on('data', d => b += d); req.on('end', () => { const { args } = JSON.parse(b); app.ctx.__n = args[0]; app.ctx.__j = args[1]; res.end(app.run('apiCall(__n, __j)')); });
  } else { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(fs.readFileSync(path.join(__dirname, '..', 'Index.html'), 'utf8').replace('<script>', shim + '<script>')); }
}).listen(port, () => console.log('http://localhost:' + port));
