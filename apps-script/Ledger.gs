// Ledger.gs - posting engine, balances, shape checks, hash chain, integrity scan.
var FF_V = FF_V || {};
FF_V.Ledger = '0.3.0';

var FF_KINDS = {
  income: 'Thu nhập',
  expense: 'Chi tiêu',
  refund: 'Hoàn tiền',
  transfer: 'Chuyển ví',
  adjustment: 'Điều chỉnh số dư',
  reversal: 'Bút toán đảo',
  loan_payment: 'Trả nợ vay',
  liability_adjustment: 'Điều chỉnh dư nợ',
  asset_purchase: 'Mua tài sản',
  asset_sale: 'Bán tài sản'
};

// ---------- State ----------
// Builds an in-memory picture of the ledger. Mutated while planning a batch so that
// balance-dependent rules (adjustments, loan overpay) see earlier items of the same batch.
function buildState_() {
  var st = {
    wallets: {}, liabs: {}, txnMap: {}, entriesBy: {}, lentriesBy: {},
    reversedBy: {}, keyMap: {}, assetSale: {}, lastHash: 'GENESIS',
    walletBal: {}, liabBal: {}, txnList: readAll_('Transactions')
  };
  readAll_('Wallets').forEach(function (w) { st.wallets[w.wallet_id] = w; st.walletBal[w.wallet_id] = w.opening_balance || 0; });
  readAll_('Liabilities').forEach(function (l) { st.liabs[l.liability_id] = l; st.liabBal[l.liability_id] = l.opening_balance || 0; });
  st.txnList.forEach(function (t) {
    st.txnMap[t.txn_id] = t;
    if (t.reverses_id) st.reversedBy[t.reverses_id] = t.txn_id;
    if (t.idempotency_key) st.keyMap[t.idempotency_key] = t.txn_id;
    st.lastHash = t.row_hash;
  });
  st.txnList.forEach(function (t) {
    if (t.txn_kind === 'asset_sale' && !st.reversedBy[t.txn_id]) st.assetSale[t.ref_id] = t.txn_id;
  });
  readAll_('Entries').forEach(function (e) {
    (st.entriesBy[e.txn_id] = st.entriesBy[e.txn_id] || []).push(e);
    applyEntryToState_(st, e, st.txnMap[e.txn_id]);
  });
  readAll_('LiabilityEntries').forEach(function (e) {
    (st.lentriesBy[e.txn_id] = st.lentriesBy[e.txn_id] || []).push(e);
    applyLentryToState_(st, e, st.txnMap[e.txn_id]);
  });
  return st;
}

function applyEntryToState_(st, e, t) {
  var w = st.wallets[e.wallet_id];
  if (t && w && t.txn_date >= w.opening_date) st.walletBal[e.wallet_id] += e.amount;
}

function applyLentryToState_(st, e, t) {
  var l = st.liabs[e.liability_id];
  if (t && l && t.txn_date >= l.opening_date) st.liabBal[e.liability_id] += e.amount;
}

// ---------- Hash chain ----------
function canon_(t, ents, lents) {
  var f = [t.txn_id, t.txn_kind, t.txn_date, t.amount, t.category_id, t.jar_id, t.paid_by, t.beneficiary,
    t.note, t.reason, t.balance_before, t.balance_after, t.reverses_id, t.ref_id, t.idempotency_key,
    t.entry_count, t.created_by, t.created_at].map(function (v) { return v === null || v === undefined ? '' : String(v); });
  var e = ents.map(function (x) { return x.wallet_id + ':' + x.amount; });
  var l = lents.map(function (x) { return x.liability_id + ':' + x.amount; });
  return JSON.stringify([f, e, l]);
}

function hashOf_(prev, t, ents, lents) { return sha256Hex_(prev + '|' + canon_(t, ents, lents)); }

// ---------- Shape rules (used when posting AND when scanning stored data) ----------
// Returns a list of problems (empty = OK). orig = {txn, ents, lents} for reversals.
function shapeIssues_(t, ents, lents, orig) {
  var p = [];
  var k = t.txn_kind;
  var amt = t.amount;
  if (!FF_KINDS[k]) return ['Loại giao dịch không hợp lệ: ' + k];
  if (typeof amt !== 'number' || !Number.isSafeInteger(amt) || amt <= 0) p.push('Số tiền phải là số nguyên dương.');
  if (!isYmd_(t.txn_date)) p.push('Ngày không hợp lệ.');
  var ne = ents.length, nl = lents.length;
  function one(sign) {
    if (ne !== 1 || nl !== 0) { p.push('Cần đúng 1 dòng ví.'); return; }
    if (ents[0].amount !== sign * amt) p.push('Dòng ví không khớp số tiền.');
  }
  switch (k) {
    case 'income': case 'asset_sale': one(1); break;
    case 'refund': one(1); break;
    case 'expense': case 'asset_purchase': one(-1); break;
    case 'transfer':
      if (ne !== 2 || nl !== 0) p.push('Chuyển ví cần đúng 2 dòng ví.');
      else {
        if (ents[0].amount !== -amt || ents[1].amount !== amt) p.push('Hai dòng chuyển ví phải bằng nhau và ngược dấu.');
        if (ents[0].wallet_id === ents[1].wallet_id) p.push('Hai ví phải khác nhau.');
      }
      break;
    case 'adjustment':
      if (ne !== 1 || nl !== 0) p.push('Điều chỉnh cần đúng 1 dòng ví.');
      else if (ents[0].amount === 0 || Math.abs(ents[0].amount) !== amt) p.push('Dòng điều chỉnh không khớp số tiền.');
      else if (t.balance_before === null || t.balance_after === null || t.balance_after - t.balance_before !== ents[0].amount) p.push('Số dư trước/sau không khớp mức điều chỉnh.');
      if (!t.reason || !String(t.reason).trim()) p.push('Điều chỉnh bắt buộc có lý do.');
      break;
    case 'loan_payment':
      if (ne !== 1 || nl !== 1) p.push('Trả nợ cần 1 dòng ví và 1 dòng nợ.');
      else if (ents[0].amount !== -amt || lents[0].amount !== -amt) p.push('Dòng trả nợ không khớp số tiền.');
      if (!t.ref_id) p.push('Thiếu khoản vay.');
      break;
    case 'liability_adjustment':
      if (ne !== 0 || nl !== 1) p.push('Điều chỉnh dư nợ cần đúng 1 dòng nợ.');
      else if (lents[0].amount === 0 || Math.abs(lents[0].amount) !== amt) p.push('Dòng điều chỉnh nợ không khớp số tiền.');
      else if (t.balance_before === null || t.balance_after === null || t.balance_after - t.balance_before !== lents[0].amount) p.push('Dư nợ trước/sau không khớp mức điều chỉnh.');
      if (!t.reason || !String(t.reason).trim()) p.push('Điều chỉnh dư nợ bắt buộc có lý do.');
      break;
    case 'reversal':
      if (!t.reverses_id) p.push('Thiếu giao dịch gốc.');
      if (!t.reason || !String(t.reason).trim()) p.push('Bút toán đảo bắt buộc có lý do.');
      if (!orig) p.push('Không tìm thấy giao dịch gốc.');
      else {
        if (orig.txn.txn_kind === 'reversal') p.push('Không đảo một bút toán đảo.');
        if (orig.txn.amount !== amt) p.push('Số tiền đảo khác giao dịch gốc.');
        var a = ents.map(function (x) { return x.wallet_id + ':' + x.amount; }).sort().join(',');
        var b = orig.ents.map(function (x) { return x.wallet_id + ':' + (-x.amount); }).sort().join(',');
        if (a !== b) p.push('Dòng ví của bút toán đảo không đối xứng với giao dịch gốc.');
        var c = lents.map(function (x) { return x.liability_id + ':' + x.amount; }).sort().join(',');
        var d = orig.lents.map(function (x) { return x.liability_id + ':' + (-x.amount); }).sort().join(',');
        if (c !== d) p.push('Dòng nợ của bút toán đảo không đối xứng với giao dịch gốc.');
      }
      break;
  }
  // jar rules
  if ((k === 'expense' || k === 'refund') && !t.jar_id) p.push('Thiếu lọ ngân sách.');
  if (k !== 'expense' && k !== 'refund' && k !== 'reversal' && t.jar_id) p.push('Loại này không được gắn lọ.');
  if (k !== 'reversal' && t.reverses_id) p.push('Chỉ bút toán đảo mới có giao dịch gốc.');
  if (t.entry_count !== ne + nl) p.push('Số dòng sổ cái không khớp entry_count.');
  return p;
}

// ---------- Planning ----------
function activeWallet_(st, id, label) {
  var w = st.wallets[id];
  if (!w) throw ffErr_('WALLET', (label || 'Ví') + ' không tồn tại.');
  if (w.status !== 'active') throw ffErr_('WALLET', (label || 'Ví') + ' "' + w.name + '" đã đóng, không nhận giao dịch mới.');
  return w;
}

function memberIdOrThrow_(id, label) {
  var ms = readAll_('Members');
  for (var i = 0; i < ms.length; i++) if (ms[i].member_id === id && ms[i].active === 1) return id;
  throw ffErr_('MEMBER', (label || 'Thành viên') + ' không hợp lệ.');
}

function beneficiaryOrThrow_(v) {
  if (!v) return '';
  if (v === 'FAMILY') return 'FAMILY';
  return memberIdOrThrow_(v, 'Người hưởng lợi');
}

function categoryOrThrow_(id, kind) {
  var cs = readAll_('Categories');
  for (var i = 0; i < cs.length; i++) {
    if (cs[i].category_id === id) {
      if (cs[i].active !== 1) throw ffErr_('CATEGORY', 'Danh mục "' + cs[i].name + '" đã ngừng dùng.');
      if (cs[i].kind !== kind) throw ffErr_('CATEGORY', 'Danh mục không phù hợp loại giao dịch.');
      return cs[i];
    }
  }
  throw ffErr_('CATEGORY', 'Danh mục không tồn tại.');
}

function jarOrThrow_(id) {
  var js = readAll_('Jars');
  for (var i = 0; i < js.length; i++) {
    if (js[i].jar_id === id) {
      if (js[i].active !== 1) throw ffErr_('JAR', 'Lọ "' + js[i].name + '" đã ngừng dùng.');
      return js[i];
    }
  }
  throw ffErr_('JAR', 'Lọ ngân sách không tồn tại.');
}

function assetOrThrow_(id) {
  var as = readAll_('Assets');
  for (var i = 0; i < as.length; i++) if (as[i].asset_id === id) return as[i];
  throw ffErr_('ASSET', 'Tài sản không tồn tại.');
}

// Validates a request and returns {plan} or {duplicate:true, txn_id}. Mutates st.
function planPost_(st, memberId, spec) {
  var k = spec.kind;
  if (!FF_KINDS[k]) throw ffErr_('KIND', 'Loại giao dịch không hợp lệ.');
  var key = spec.key ? String(spec.key) : '';
  if (key.length > 120) throw ffErr_('KEY', 'Mã chống trùng quá dài.');
  if (key && st.keyMap[key]) return { duplicate: true, txn_id: st.keyMap[key] };

  var t = {
    txn_id: newId_('T'), txn_kind: k, txn_date: ymd_(spec.date, 'Ngày'), amount: 0,
    category_id: '', jar_id: '', paid_by: '', beneficiary: '', note: clip_(spec.note, 500), reason: '',
    balance_before: null, balance_after: null, reverses_id: '', ref_id: '', idempotency_key: key,
    entry_count: 0, created_by: memberId, created_at: nowIso_(), prev_hash: '', row_hash: ''
  };
  var ents = [], lents = [], orig = null, cat, w, w2, jar, liab, asset;

  switch (k) {
    case 'income':
      t.amount = amount_(spec.amount);
      w = activeWallet_(st, spec.wallet_id);
      if (spec.category_id) t.category_id = categoryOrThrow_(spec.category_id, 'income').category_id;
      t.beneficiary = beneficiaryOrThrow_(spec.beneficiary);
      ents.push({ wallet_id: w.wallet_id, amount: t.amount });
      break;

    case 'expense': case 'refund':
      t.amount = amount_(spec.amount);
      w = activeWallet_(st, spec.wallet_id);
      cat = spec.category_id ? categoryOrThrow_(spec.category_id, 'expense') : null;
      var jarId = spec.jar_id || (cat && cat.jar_id) || '';
      if (!jarId) throw ffErr_('JAR', 'Hãy chọn lọ ngân sách.');
      jar = jarOrThrow_(jarId);
      if (cat && cat.jar_id && cat.jar_id !== jar.jar_id) throw ffErr_('JAR', 'Danh mục "' + cat.name + '" không thuộc lọ "' + jar.name + '".');
      t.jar_id = jar.jar_id;
      t.category_id = cat ? cat.category_id : '';
      if (k === 'expense') t.paid_by = memberIdOrThrow_(spec.paid_by, 'Người chi');
      else if (spec.paid_by) t.paid_by = memberIdOrThrow_(spec.paid_by, 'Người nhận hoàn');
      t.beneficiary = beneficiaryOrThrow_(spec.beneficiary);
      ents.push({ wallet_id: w.wallet_id, amount: k === 'expense' ? -t.amount : t.amount });
      break;

    case 'transfer':
      t.amount = amount_(spec.amount);
      w = activeWallet_(st, spec.from_wallet, 'Ví nguồn');
      w2 = activeWallet_(st, spec.to_wallet, 'Ví đích');
      if (w.wallet_id === w2.wallet_id) throw ffErr_('WALLET', 'Ví nguồn và ví đích phải khác nhau.');
      ents.push({ wallet_id: w.wallet_id, amount: -t.amount }, { wallet_id: w2.wallet_id, amount: t.amount });
      break;

    case 'adjustment':
      w = st.wallets[spec.wallet_id];
      if (!w) throw ffErr_('WALLET', 'Ví không tồn tại.');
      if (t.txn_date < w.opening_date) throw ffErr_('DATE', 'Ngày điều chỉnh không được trước ngày bắt đầu của ví (' + w.opening_date + ').');
      t.reason = reqText_(spec.reason, 'Lý do điều chỉnh', 3, 300);
      var actual = signed_(spec.actual_balance, 'Số dư thực tế');
      var before = st.walletBal[w.wallet_id];
      var delta = actual - before;
      if (delta === 0) throw ffErr_('ADJ0', 'Số dư thực tế trùng số dư hệ thống, không cần điều chỉnh.');
      t.amount = Math.abs(delta); t.balance_before = before; t.balance_after = actual;
      ents.push({ wallet_id: w.wallet_id, amount: delta });
      break;

    case 'loan_payment':
      t.amount = amount_(spec.amount);
      liab = st.liabs[spec.liability_id];
      if (!liab) throw ffErr_('LIAB', 'Khoản vay không tồn tại.');
      if (t.txn_date < liab.opening_date) throw ffErr_('DATE', 'Ngày trả nợ không được trước ngày bắt đầu của khoản vay (' + liab.opening_date + ').');
      w = activeWallet_(st, spec.wallet_id);
      if (t.amount > st.liabBal[liab.liability_id]) throw ffErr_('LIAB', 'Số tiền trả vượt dư nợ hiện tại.');
      t.ref_id = liab.liability_id;
      ents.push({ wallet_id: w.wallet_id, amount: -t.amount });
      lents.push({ liability_id: liab.liability_id, amount: -t.amount });
      break;

    case 'liability_adjustment':
      liab = st.liabs[spec.liability_id];
      if (!liab) throw ffErr_('LIAB', 'Khoản vay không tồn tại.');
      if (t.txn_date < liab.opening_date) throw ffErr_('DATE', 'Ngày điều chỉnh không được trước ngày bắt đầu của khoản vay.');
      t.reason = reqText_(spec.reason, 'Lý do điều chỉnh', 3, 300);
      var actualDebt = signed_(spec.actual_balance, 'Dư nợ thực tế');
      if (actualDebt < 0) throw ffErr_('AMOUNT', 'Dư nợ không được âm.');
      var beforeDebt = st.liabBal[liab.liability_id];
      var d = actualDebt - beforeDebt;
      if (d === 0) throw ffErr_('ADJ0', 'Dư nợ thực tế trùng dư nợ hệ thống, không cần điều chỉnh.');
      t.amount = Math.abs(d); t.balance_before = beforeDebt; t.balance_after = actualDebt; t.ref_id = liab.liability_id;
      lents.push({ liability_id: liab.liability_id, amount: d });
      break;

    case 'asset_purchase': case 'asset_sale':
      t.amount = amount_(spec.amount);
      asset = assetOrThrow_(spec.asset_id);
      w = activeWallet_(st, spec.wallet_id);
      if (k === 'asset_sale' && st.assetSale[asset.asset_id]) throw ffErr_('ASSET', 'Tài sản này đã được bán.');
      t.ref_id = asset.asset_id;
      ents.push({ wallet_id: w.wallet_id, amount: k === 'asset_purchase' ? -t.amount : t.amount });
      break;

    case 'reversal':
      var o = st.txnMap[spec.txn_id];
      if (!o) throw ffErr_('REV', 'Không tìm thấy giao dịch cần đảo.');
      if (o.txn_kind === 'reversal') throw ffErr_('REV', 'Không thể đảo một bút toán đảo.');
      if (st.reversedBy[o.txn_id]) throw ffErr_('REV', 'Giao dịch này đã được đảo trước đó.');
      t.reason = reqText_(spec.reason, 'Lý do đảo', 3, 300);
      orig = { txn: o, ents: st.entriesBy[o.txn_id] || [], lents: st.lentriesBy[o.txn_id] || [] };
      t.reverses_id = o.txn_id; t.amount = o.amount; t.txn_date = o.txn_date;
      t.category_id = o.category_id; t.jar_id = o.jar_id; t.ref_id = o.ref_id;
      t.paid_by = o.paid_by; t.beneficiary = o.beneficiary;
      orig.ents.forEach(function (e) { ents.push({ wallet_id: e.wallet_id, amount: -e.amount }); });
      orig.lents.forEach(function (e) { lents.push({ liability_id: e.liability_id, amount: -e.amount }); });
      break;
  }

  t.entry_count = ents.length + lents.length;
  var issues = shapeIssues_(t, ents, lents, orig);
  if (issues.length) throw ffErr_('SHAPE', issues[0]);

  t.prev_hash = st.lastHash;
  t.row_hash = hashOf_(t.prev_hash, t, ents, lents);
  var eRows = ents.map(function (e, i) { return { entry_id: t.txn_id + '-' + (i + 1), txn_id: t.txn_id, wallet_id: e.wallet_id, amount: e.amount }; });
  var lRows = lents.map(function (e, i) { return { entry_id: t.txn_id + '-L' + (i + 1), txn_id: t.txn_id, liability_id: e.liability_id, amount: e.amount }; });

  // update in-memory state for the next item of a batch
  st.lastHash = t.row_hash;
  st.txnMap[t.txn_id] = t;
  st.txnList.push(t);
  if (key) st.keyMap[key] = t.txn_id;
  if (t.reverses_id) st.reversedBy[t.reverses_id] = t.txn_id;
  st.entriesBy[t.txn_id] = eRows; st.lentriesBy[t.txn_id] = lRows;
  eRows.forEach(function (e) { applyEntryToState_(st, e, t); });
  lRows.forEach(function (e) { applyLentryToState_(st, e, t); });
  if (k === 'asset_sale') st.assetSale[t.ref_id] = t.txn_id;
  if (k === 'reversal' && orig.txn.txn_kind === 'asset_sale') delete st.assetSale[orig.txn.ref_id];

  return { duplicate: false, txn_id: t.txn_id, plan: { txn: t, ents: eRows, lents: lRows } };
}

// Ledger lines are written first and the transaction header last: a header exists
// only if all of its lines exist.
function commitPlans_(plans, chunk) {
  chunk = chunk || 400;
  for (var i = 0; i < plans.length; i += chunk) {
    var part = plans.slice(i, i + chunk), E = [], L = [], T = [];
    part.forEach(function (p) {
      Array.prototype.push.apply(E, p.ents);
      Array.prototype.push.apply(L, p.lents);
      T.push(p.txn);
    });
    appendRows_('Entries', E);
    appendRows_('LiabilityEntries', L);
    appendRows_('Transactions', T);
  }
}

// One locked posting. spec = {kind, date, amount, wallet_id, ...}
function postOne_(m, spec) {
  return withLock_(function () {
    var st = buildState_();
    var r = planPost_(st, m.member_id, spec);
    if (r.duplicate) return { txn_id: r.txn_id, duplicate: true };
    commitPlans_([r.plan]);
    audit_('post:' + spec.kind, r.txn_id, { amount: r.plan.txn.amount, date: r.plan.txn.txn_date });
    return { txn_id: r.txn_id, duplicate: false };
  });
}

// ---------- Public-ish service helpers (called by Api.gs) ----------
function svcIncome_(m, p) { return postOne_(m, { kind: 'income', date: p.date, amount: p.amount, wallet_id: p.wallet_id, category_id: p.category_id, beneficiary: p.beneficiary, note: p.note, key: p.key }); }
function svcExpense_(m, p) { return postOne_(m, { kind: 'expense', date: p.date, amount: p.amount, wallet_id: p.wallet_id, jar_id: p.jar_id, category_id: p.category_id, paid_by: p.paid_by, beneficiary: p.beneficiary, note: p.note, key: p.key }); }
function svcRefund_(m, p) { return postOne_(m, { kind: 'refund', date: p.date, amount: p.amount, wallet_id: p.wallet_id, jar_id: p.jar_id, category_id: p.category_id, paid_by: p.paid_by, beneficiary: p.beneficiary, note: p.note, key: p.key }); }
function svcTransfer_(m, p) { return postOne_(m, { kind: 'transfer', date: p.date, amount: p.amount, from_wallet: p.from_wallet, to_wallet: p.to_wallet, note: p.note, key: p.key }); }
function svcAdjust_(m, p) { return postOne_(m, { kind: 'adjustment', date: p.date || todayYmd_(), wallet_id: p.wallet_id, actual_balance: p.actual_balance, reason: p.reason, note: p.note, key: p.key }); }
function svcReverse_(m, p) { return postOne_(m, { kind: 'reversal', date: todayYmd_(), txn_id: p.txn_id, reason: p.reason, key: p.key }); }
function svcLoanPay_(m, p) { return postOne_(m, { kind: 'loan_payment', date: p.date, amount: p.amount, wallet_id: p.wallet_id, liability_id: p.liability_id, note: p.note, key: p.key }); }
function svcLoanAdjust_(m, p) { return postOne_(m, { kind: 'liability_adjustment', date: p.date || todayYmd_(), liability_id: p.liability_id, actual_balance: p.actual_balance, reason: p.reason, note: p.note, key: p.key }); }
function svcAssetBuy_(m, p) { return postOne_(m, { kind: 'asset_purchase', date: p.date, amount: p.amount, wallet_id: p.wallet_id, asset_id: p.asset_id, note: p.note, key: p.key }); }
function svcAssetSell_(m, p) { return postOne_(m, { kind: 'asset_sale', date: p.date, amount: p.amount, wallet_id: p.wallet_id, asset_id: p.asset_id, note: p.note, key: p.key }); }

// ---------- Balances ----------
function walletBalances_() {
  var st = buildState_();
  return st.walletBal;
}

// ---------- Integrity scan ----------
// Recomputes the hash chain and re-checks every stored transaction. Read-only.
function integrityScan_() {
  FF_CTX.cache = {};
  var issues = [];
  function add(code, ref, msg) { issues.push({ code: code, ref: ref || '', msg: msg }); }
  var txns = readAll_('Transactions');
  var ents = readAll_('Entries'), lents = readAll_('LiabilityEntries');
  var wallets = {}, liabs = {};
  readAll_('Wallets').forEach(function (w) { wallets[w.wallet_id] = w; });
  readAll_('Liabilities').forEach(function (l) { liabs[l.liability_id] = l; });
  var txMap = {}, entBy = {}, lentBy = {}, seenKeys = {}, reversedSeen = {};
  txns.forEach(function (t) {
    if (txMap[t.txn_id]) add('dup_txn', t.txn_id, 'Trùng mã giao dịch.');
    txMap[t.txn_id] = t;
  });
  var seenEntry = {};
  ents.forEach(function (e) {
    if (seenEntry[e.entry_id]) add('dup_entry', e.entry_id, 'Trùng mã dòng sổ cái.');
    seenEntry[e.entry_id] = true;
    (entBy[e.txn_id] = entBy[e.txn_id] || []).push(e);
    if (!txMap[e.txn_id]) add('orphan_entry', e.entry_id, 'Dòng sổ cái không có giao dịch.');
    if (!wallets[e.wallet_id]) add('unknown_wallet', e.entry_id, 'Dòng sổ cái trỏ tới ví không tồn tại.');
  });
  lents.forEach(function (e) {
    if (seenEntry[e.entry_id]) add('dup_entry', e.entry_id, 'Trùng mã dòng nợ.');
    seenEntry[e.entry_id] = true;
    (lentBy[e.txn_id] = lentBy[e.txn_id] || []).push(e);
    if (!txMap[e.txn_id]) add('orphan_entry', e.entry_id, 'Dòng nợ không có giao dịch.');
    if (!liabs[e.liability_id]) add('unknown_liability', e.entry_id, 'Dòng nợ trỏ tới khoản vay không tồn tại.');
  });
  var prev = 'GENESIS';
  txns.forEach(function (t) {
    var te = entBy[t.txn_id] || [], tl = lentBy[t.txn_id] || [];
    if (t.prev_hash !== prev) add('chain', t.txn_id, 'Chuỗi mã băm bị đứt tại giao dịch này.');
    var expected = hashOf_(t.prev_hash, t, te, tl);
    if (t.row_hash !== expected) add('hash', t.txn_id, 'Nội dung giao dịch hoặc dòng sổ cái đã bị sửa.');
    prev = t.row_hash;
    if (t.idempotency_key) {
      if (seenKeys[t.idempotency_key]) add('dup_key', t.txn_id, 'Trùng mã chống trùng.');
      seenKeys[t.idempotency_key] = true;
    }
    var orig = null;
    if (t.txn_kind === 'reversal') {
      var o = txMap[t.reverses_id];
      if (o) orig = { txn: o, ents: entBy[o.txn_id] || [], lents: lentBy[o.txn_id] || [] };
      if (reversedSeen[t.reverses_id]) add('double_reversal', t.txn_id, 'Giao dịch gốc bị đảo nhiều lần.');
      reversedSeen[t.reverses_id] = true;
    }
    shapeIssues_(t, te, tl, orig).forEach(function (m) { add('shape', t.txn_id, m); });
  });
  return { ok: issues.length === 0, issues: issues, counts: { txns: txns.length, entries: ents.length, lentries: lents.length }, last_hash: prev };
}
