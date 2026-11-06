// Reports.gs - read-only views: bootstrap data, transaction list, dashboard.
var FF_V = FF_V || {};
FF_V.Reports = '0.3.0';

function nameMap_(sheet, idCol, nameCol) {
  var m = {};
  readAll_(sheet).forEach(function (r) { m[r[idCol]] = r[nameCol]; });
  return m;
}

// Everything the UI needs to render forms.
function bootstrap_(m) {
  var st = buildState_();
  return {
    version: FF_V.Core,
    me: { member_id: m.member_id, display_name: m.display_name, email: m.email },
    today: todayYmd_(),
    period: currentPeriod_(),
    members: readAll_('Members').filter(function (x) { return x.active === 1; }).map(function (x) { return { member_id: x.member_id, display_name: x.display_name }; }),
    wallets: readAll_('Wallets').map(function (w) {
      return { wallet_id: w.wallet_id, name: w.name, wallet_type: w.wallet_type, bank_name: w.bank_name, owner_member_id: w.owner_member_id, holder_name: w.holder_name, opening_balance: w.opening_balance, opening_date: w.opening_date, status: w.status, balance: st.walletBal[w.wallet_id] };
    }),
    jars: readAll_('Jars').map(function (j) { return { jar_id: j.jar_id, name: j.name, sort_order: j.sort_order, active: j.active }; }).sort(function (a, b) { return a.sort_order - b.sort_order; }),
    categories: readAll_('Categories').map(function (c) { return { category_id: c.category_id, name: c.name, kind: c.kind, jar_id: c.jar_id, active: c.active }; }),
    kinds: FF_KINDS,
    asset_types: FF_ASSET_TYPES,
    settings: { cutoff_date: getSetting_('cutoff_date'), budget_warn_pct: getSetting_('budget_warn_pct'), data_entry_days: getSetting_('data_entry_days') }
  };
}

function listTxns_(m, f) {
  f = f || {};
  var txns = readAll_('Transactions');
  var tmap = txnMap_(txns);
  var ents = readAll_('Entries'), lents = readAll_('LiabilityEntries');
  var entBy = {}, lentBy = {}, reversedBy = {};
  ents.forEach(function (e) { (entBy[e.txn_id] = entBy[e.txn_id] || []).push(e); });
  lents.forEach(function (e) { (lentBy[e.txn_id] = lentBy[e.txn_id] || []).push(e); });
  txns.forEach(function (t) { if (t.reverses_id) reversedBy[t.reverses_id] = t.txn_id; });
  var wn = nameMap_('Wallets', 'wallet_id', 'name'), jn = nameMap_('Jars', 'jar_id', 'name'),
    cn = nameMap_('Categories', 'category_id', 'name'), mn = nameMap_('Members', 'member_id', 'display_name'),
    ln = nameMap_('Liabilities', 'liability_id', 'name'), an = nameMap_('Assets', 'asset_id', 'name');
  mn.FAMILY = 'Cả gia đình';
  var q = f.q ? String(f.q).toLowerCase() : '';
  var out = [];
  txns.forEach(function (t) {
    if (f.period && periodOf_(t.txn_date) !== f.period) return;
    if (f.kind && t.txn_kind !== f.kind) return;
    if (f.jar_id && t.jar_id !== f.jar_id) return;
    var te = entBy[t.txn_id] || [];
    if (f.wallet_id && !te.some(function (e) { return e.wallet_id === f.wallet_id; })) return;
    if (q && (t.note + ' ' + t.reason).toLowerCase().indexOf(q) < 0) return;
    out.push({
      txn_id: t.txn_id, date: t.txn_date, kind: t.txn_kind, kind_label: FF_KINDS[t.txn_kind] || t.txn_kind, amount: t.amount,
      lines: te.map(function (e) { return { wallet_id: e.wallet_id, wallet: wn[e.wallet_id] || e.wallet_id, amount: e.amount }; }),
      debt_lines: (lentBy[t.txn_id] || []).map(function (e) { return { liability: ln[e.liability_id] || e.liability_id, amount: e.amount }; }),
      jar: jn[t.jar_id] || '', category: cn[t.category_id] || '', paid_by: mn[t.paid_by] || '', beneficiary: mn[t.beneficiary] || '',
      ref: ln[t.ref_id] || an[t.ref_id] || '', note: t.note, reason: t.reason, balance_before: t.balance_before, balance_after: t.balance_after,
      reverses_id: t.reverses_id, reversed: !!reversedBy[t.txn_id],
      reversible: t.txn_kind !== 'reversal' && !reversedBy[t.txn_id],
      created_by: mn[t.created_by] || '', created_at: t.created_at
    });
  });
  out.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (a.created_at < b.created_at ? 1 : -1); });
  var total = out.length;
  var off = Math.max(0, Number(f.offset) || 0), lim = Math.min(300, Math.max(1, Number(f.limit) || 100));
  return { total: total, offset: off, rows: out.slice(off, off + lim) };
}

// Income / expense / net cash flow for a period (transfers, adjustments, loan payments and
// asset purchases are deliberately excluded).
function cashFlow_(period, txns, tmap) {
  var inc = 0, exp = 0, adjPos = 0, adjNeg = 0;
  txns.forEach(function (t) {
    if (periodOf_(t.txn_date) !== period) return;
    inc += incomeEffect_(t, tmap);
    exp += expenseEffect_(t, tmap);
    if (t.txn_kind === 'adjustment') { if (t.balance_after > t.balance_before) adjPos += t.amount; else adjNeg += t.amount; }
  });
  return { income: inc, expense: exp, net: inc - exp, adjustments_up: adjPos, adjustments_down: adjNeg };
}

function dashboard_(m, period) {
  period = period || currentPeriod_();
  if (!isPeriod_(period)) throw ffErr_('PERIOD', 'Tháng không hợp lệ.');
  var st = buildState_();
  var txns = st.txnList, tmap = st.txnMap;
  var nw = netWorth_();
  var wallets = readAll_('Wallets').map(function (w) {
    return { wallet_id: w.wallet_id, name: w.name, wallet_type: w.wallet_type, status: w.status, balance: st.walletBal[w.wallet_id] };
  });
  var flow = cashFlow_(period, txns, tmap);
  var budget = budgetView_(m, period);
  var alerts = [];
  budget.jars.forEach(function (j) {
    if (j.status === 'over') alerts.push({ level: 'over', text: 'Lọ "' + j.name + '" đã vượt ngân sách ' + (j.spent - j.budget) });
    else if (j.status === 'warn') alerts.push({ level: 'warn', text: 'Lọ "' + j.name + '" đã dùng ' + j.pct + '% ngân sách' });
  });
  var recent = listTxns_(m, { limit: 8 }).rows;
  return {
    period: period,
    cash_available: nw.cash, savings: nw.savings, assets: nw.assets, liabilities: nw.liabilities, held_in_trust: nw.held_in_trust, net_worth: nw.net_worth,
    flow: flow, budget: budget, wallets: wallets, alerts: alerts, recent: recent,
    health: { last_integrity: getSetting_('last_integrity', ''), last_backup_weekly: getSetting_('last_backup_weekly', ''), last_backup_monthly: getSetting_('last_backup_monthly', '') }
  };
}
