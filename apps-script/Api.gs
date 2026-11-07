// Api.gs - web app entry point and the ONLY door the browser can use.
// Every call is authenticated against the Members sheet; unknown names are rejected.
var FF_V = FF_V || {};
FF_V.Api = '0.3.0';

function ffApi_() { return {
  bootstrap: function (m, p) { return bootstrap_(m); },
  dashboard: function (m, p) { return dashboard_(m, p.period); },
  txns: function (m, p) { return listTxns_(m, p); },
  budget: function (m, p) { return withLock_(function () { ensurePeriod_(m, p.period || currentPeriod_()); return budgetView_(m, p.period || currentPeriod_()); }); },
  assets: function (m, p) { return assetsView_(); },
  debts: function (m, p) { return debtsView_(); },
  reminders: function (m, p) { return listReminders_(); },
  health: function (m, p) { return healthView_(); },

  income: svcIncome_,
  expense: svcExpense_,
  refund: svcRefund_,
  transfer: svcTransfer_,
  adjust: svcAdjust_,
  reverse: svcReverse_,
  loanPay: svcLoanPay_,
  loanAdjust: svcLoanAdjust_,
  assetBuy: svcAssetBuy_,
  assetSell: svcAssetSell_,
  debtNew: svcDebtNew_,
  debtCollect: svcDebtCollect_,
  debtRepay: svcDebtRepay_,
  debtAdjust: svcDebtAdjust_,

  setBudget: setJarBudget_,
  moveBudget: moveBudget_,
  createAsset: createAsset_,
  updateAsset: updateAsset_,
  deleteAsset: deleteAsset_,
  createLiability: createLiability_,
  updateLiability: updateLiability_,
  addLiabilityRate: addLiabilityRate_,
  liabilityHistory: function (m, p) { return liabilityHistory_(p.liability_id); },
  saveWallet: saveWallet_,
  setWalletOpening: setWalletOpening_,
  saveJar: saveJar_,
  saveCategory: saveCategory_,
  saveSettings: saveSettings_,
  saveReminder: saveReminder_,

  runIntegrity: function (m, p) { var r = integrityJob_(); return { ok: r.ok, issues: r.issues.slice(0, 50), counts: r.counts }; },
  importDry: function (m, p) { return importDryRun_(m, p); },
  importRun: function (m, p) { return importRun_(m, p); }
}; }

function healthView_() {
  return {
    last_integrity: getSetting_('last_integrity', ''), last_backup_weekly: getSetting_('last_backup_weekly', ''),
    last_backup_monthly: getSetting_('last_backup_monthly', ''), version: FF_V
  };
}

function apiCall(name, json) {
  try {
    var m = requireMember_();
    var api = ffApi_();
    var fn = Object.prototype.hasOwnProperty.call(api, name) ? api[name] : null;
    if (!fn) throw ffErr_('API', 'Chức năng không tồn tại.');
    var p = json ? JSON.parse(json) : {};
    if (p === null || typeof p !== 'object') p = {};
    return JSON.stringify({ ok: true, data: fn(m, p) });
  } catch (e) {
    if (e && e.ffCode) return JSON.stringify({ ok: false, code: e.ffCode, error: e.message });
    var ref = Utilities.getUuid().slice(0, 8);
    try { audit_('error:api', ref, { name: name, msg: String(e && e.message || e).slice(0, 300) }); } catch (x) { /* ignore */ }
    return JSON.stringify({ ok: false, code: 'SYSTEM', error: 'Có lỗi hệ thống. Thử lại sau; nếu vẫn lỗi hãy báo người quản trị (mã ' + ref + ').' });
  }
}

function doGet(e) {
  try {
    requireMember_();
  } catch (err) {
    return HtmlService.createHtmlOutput(
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<body style="font-family:system-ui;padding:24px;max-width:480px;margin:auto">' +
      '<h2>Family Finance</h2><p>' + String(err && err.message || 'Không có quyền truy cập.').replace(/</g, '&lt;') + '</p></body>'
    ).setTitle('Family Finance');
  }
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Family Finance')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
