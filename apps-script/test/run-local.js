'use strict';
const { loadApp } = require('./mock-gas');
const app = loadApp();
const out = app.run('runAllTests()');
console.log(out);
process.exit(/^TẤT CẢ ĐẠT/.test(out) ? 0 : 1);
