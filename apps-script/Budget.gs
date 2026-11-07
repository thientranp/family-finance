// Budget.gs - monthly jar budgets, copy-forward, moves between jars, spending per jar.
var FF_V = FF_V || {};
FF_V.Budget = '0.3.0';

function periodOf_(ymd) { return String(ymd).slice(0, 7); }

function currentPeriod_() { return periodOf_(todayYmd_()); }

// Signed contribution of a transaction to "spent" of its jar (+ = more spent).
function jarEffect_(t, txnMap) {
  var k = t.txn_kind;
  if (k === 'expense') return t.amount;
  if (k === 'refund') return -t.amount;
  if (k === 'reversal') {
    var o = txnMap[t.reverses_id];
    if (!o) return 0;
    if (o.txn_kind === 'expense') return -t.amount;
    if (o.txn_kind === 'refund') return t.amount;
  }
  return 0;
}

// Signed contribution to recognised income (income, asset sales, gold sales).
function incomeEffect_(t, txnMap) {
  var k = t.txn_kind;
  if (k === 'income' || k === 'asset_sale' || k === 'gold_sale') return t.amount;
  if (k === 'reversal') {
    var o = txnMap[t.reverses_id];
    if (o && (o.txn_kind === 'income' || o.txn_kind === 'asset_sale' || o.txn_kind === 'gold_sale')) return -t.amount;
  }
  return 0;
}

// Signed contribution to recognised expense (expense minus refunds).
function expenseEffect_(t, txnMap) { return jarEffect_(t, txnMap); }

function txnMap_(txns) {
  var m = {};
  txns.forEach(function (t) { m[t.txn_id] = t; });
  return m;
}

// Spent per jar for one period.
function spentByJar_(period, txns, tmap) {
  var out = {};
  txns.forEach(function (t) {
    if (periodOf_(t.txn_date) !== period || !t.jar_id) return;
    var e = jarEffect_(t, tmap);
    if (e) out[t.jar_id] = (out[t.jar_id] || 0) + e;
  });
  return out;
}

// Make sure a period has budget rows. A new period copies the latest earlier period
// (REQ-002). If there is no earlier period, amounts start at 0.
function ensurePeriod_(m, period) {
  if (!isPeriod_(period)) throw ffErr_('PERIOD', 'Tháng không hợp lệ.');
  var rows = readAll_('Budgets');
  var have = {};
  var latestPrior = '';
  rows.forEach(function (r) {
    if (r.period === period) have[r.jar_id] = true;
    else if (r.period < period && r.period > latestPrior) latestPrior = r.period;
  });
  var prior = {};
  if (latestPrior) rows.forEach(function (r) { if (r.period === latestPrior) prior[r.jar_id] = r.amount; });
  var add = [];
  readAll_('Jars').forEach(function (j) {
    if (j.active === 1 && !have[j.jar_id]) {
      add.push({ period: period, jar_id: j.jar_id, amount: prior[j.jar_id] || 0, created_at: nowIso_(), created_by: m ? m.member_id : 'system' });
    }
  });
  if (add.length) {
    appendRows_('Budgets', add);
    audit_('budget:create', period, { copied_from: latestPrior || null, jars: add.length });
  }
  return add.length;
}

function budgetView_(m, period) {
  if (!isPeriod_(period)) throw ffErr_('PERIOD', 'Tháng không hợp lệ.');
  var warn = Number(getSetting_('budget_warn_pct', '80')) || 80;
  var txns = readAll_('Transactions'), tmap = txnMap_(txns);
  var spent = spentByJar_(period, txns, tmap);
  var base = {}, hasRows = false;
  readAll_('Budgets').forEach(function (r) { if (r.period === period) { base[r.jar_id] = r.amount; hasRows = true; } });
  var inc = {}, out = {};
  readAll_('BudgetMoves').forEach(function (mv) {
    if (mv.period !== period) return;
    out[mv.from_jar] = (out[mv.from_jar] || 0) + mv.amount;
    inc[mv.to_jar] = (inc[mv.to_jar] || 0) + mv.amount;
  });
  var jars = [];
  readAll_('Jars').forEach(function (j) {
    if (j.active !== 1 && !spent[j.jar_id] && !base[j.jar_id]) return;
    var b = base[j.jar_id] || 0;
    var eff = b + (inc[j.jar_id] || 0) - (out[j.jar_id] || 0);
    var sp = spent[j.jar_id] || 0;
    var rem = eff - sp;
    var pct = eff > 0 ? Math.round(sp * 1000 / eff) / 10 : (sp > 0 ? 999 : 0);
    var status = 'ok';
    if (sp > eff) status = 'over';
    else if (eff > 0 && pct >= warn) status = 'warn';
    jars.push({ jar_id: j.jar_id, name: j.name, base: b, moved_in: inc[j.jar_id] || 0, moved_out: out[j.jar_id] || 0, budget: eff, spent: sp, remaining: rem, pct: pct, status: status, active: j.active });
  });
  var totalBudget = 0, totalSpent = 0;
  jars.forEach(function (j) { totalBudget += j.budget; totalSpent += j.spent; });
  return { period: period, exists: hasRows, editable: period >= currentPeriod_(), jars: jars, total_budget: totalBudget, total_spent: totalSpent, warn_pct: warn };
}

function setJarBudget_(m, p) {
  return withLock_(function () {
    var period = p.period;
    if (!isPeriod_(period)) throw ffErr_('PERIOD', 'Tháng không hợp lệ.');
    if (period < currentPeriod_()) throw ffErr_('PERIOD', 'Không sửa ngân sách của tháng đã qua.');
    var amt = signed_(p.amount, 'Số tiền ngân sách');
    if (amt < 0) throw ffErr_('AMOUNT', 'Ngân sách không được âm.');
    var jar = jarOrThrow_(p.jar_id);
    ensurePeriod_(m, period);
    var rows = readAll_('Budgets');
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].period === period && rows[i].jar_id === jar.jar_id) {
        var before = rows[i].amount;
        updateRow_('Budgets', rows[i]._row, { amount: amt });
        audit_('budget:set', period + '/' + jar.jar_id, { before: before, after: amt });
        return { period: period, jar_id: jar.jar_id, before: before, after: amt };
      }
    }
    throw ffErr_('BUDGET', 'Không tìm thấy dòng ngân sách.');
  });
}

// Move budget between jars (REQ-023): recorded in BudgetMoves, never counted as spending.
function moveBudget_(m, p) {
  return withLock_(function () {
    var period = p.period;
    if (!isPeriod_(period)) throw ffErr_('PERIOD', 'Tháng không hợp lệ.');
    if (period < currentPeriod_()) throw ffErr_('PERIOD', 'Không chuyển ngân sách của tháng đã qua.');
    var amt = amount_(p.amount);
    var from = jarOrThrow_(p.from_jar), to = jarOrThrow_(p.to_jar);
    if (from.jar_id === to.jar_id) throw ffErr_('JAR', 'Hai lọ phải khác nhau.');
    var reason = reqText_(p.reason, 'Lý do', 3, 300);
    ensurePeriod_(m, period);
    var view = budgetView_(m, period);
    var src = view.jars.filter(function (j) { return j.jar_id === from.jar_id; })[0];
    if (!src || src.budget < amt) throw ffErr_('BUDGET', 'Lọ nguồn không đủ ngân sách để chuyển.');
    var id = newId_('B');
    appendRows_('BudgetMoves', [{ move_id: id, period: period, from_jar: from.jar_id, to_jar: to.jar_id, amount: amt, reason: reason, created_by: m.member_id, created_at: nowIso_() }]);
    audit_('budget:move', id, { period: period, from: from.jar_id, to: to.jar_id, amount: amt });
    return { move_id: id };
  });
}
