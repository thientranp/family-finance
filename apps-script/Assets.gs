// Assets.gs - assets (at purchase price), liabilities, net worth.
var FF_V = FF_V || {};
FF_V.Assets = '0.3.0';

var FF_ASSET_TYPES = { house: 'Nhà', car: 'Xe', gold: 'Vàng', investment: 'Đầu tư', other: 'Khác' };

function createAsset_(m, p) {
  return withLock_(function () {
    var type = String(p.asset_type || 'other');
    if (!FF_ASSET_TYPES[type]) throw ffErr_('ASSET', 'Loại tài sản không hợp lệ.');
    var row = {
      asset_id: nextCode_('Assets', 'asset_id', 'A', 3), asset_type: type,
      name: reqText_(p.name, 'Tên tài sản', 2, 120),
      purchase_value: signed_(p.purchase_value, 'Giá mua'),
      purchase_date: ymd_(p.purchase_date, 'Ngày mua'), note: clip_(p.note, 300), active: 1
    };
    if (row.purchase_value < 0) throw ffErr_('AMOUNT', 'Giá mua không được âm.');
    var dup = readAll_('Assets').some(function (a) { return a.name.toLowerCase() === row.name.toLowerCase(); });
    if (dup) throw ffErr_('ASSET', 'Đã có tài sản trùng tên.');
    appendRows_('Assets', [row]);
    audit_('asset:create', row.asset_id, { name: row.name, value: row.purchase_value });
    return { asset_id: row.asset_id };
  });
}

// True if any transaction (buy or sell, even a reversed one) ever referenced this asset — the line
// between "safe to hard-delete" and "must only deactivate" (see deleteRow_ in Core.gs).
function assetHasTxn_(assetId) {
  return readAll_('Transactions').some(function (t) {
    return t.ref_id === assetId && (t.txn_kind === 'asset_purchase' || t.txn_kind === 'asset_sale');
  });
}

function deleteAsset_(m, p) {
  return withLock_(function () {
    var a = assetOrThrow_(p.asset_id);
    if (assetHasTxn_(a.asset_id)) throw ffErr_('ASSET', 'Tài sản này đã có giao dịch (mua/bán) — không xoá được, chỉ có thể ẩn.');
    deleteRow_('Assets', a._row);
    audit_('asset:delete', a.asset_id, { name: a.name });
    return { ok: true };
  });
}

function updateAsset_(m, p) {
  return withLock_(function () {
    var a = assetOrThrow_(p.asset_id);
    var patch = {};
    if (p.name !== undefined) patch.name = reqText_(p.name, 'Tên tài sản', 2, 120);
    if (p.note !== undefined) patch.note = clip_(p.note, 300);
    if (p.active !== undefined) patch.active = p.active ? 1 : 0;
    if (p.purchase_value !== undefined) {
      patch.purchase_value = signed_(p.purchase_value, 'Giá mua');
      if (patch.purchase_value < 0) throw ffErr_('AMOUNT', 'Giá mua không được âm.');
    }
    updateRow_('Assets', a._row, patch);
    audit_('asset:update', a.asset_id, { before: { name: a.name, value: a.purchase_value, active: a.active }, patch: patch });
    return { asset_id: a.asset_id };
  });
}

function liabilityOrThrow_(id) {
  var l = readAll_('Liabilities').filter(function (x) { return x.liability_id === id; })[0];
  if (!l) throw ffErr_('LIAB', 'Khoản vay không tồn tại.');
  return l;
}

// term_months (optional): kỳ hạn vay tính bằng tháng. UI nhận "số năm" thì tự quy đổi *12 trước khi
// gửi lên — ở đây luôn lưu và trả về theo tháng cho thống nhất.
function createLiability_(m, p) {
  return withLock_(function () {
    var open = signed_(p.opening_balance, 'Dư nợ ban đầu');
    if (open < 0) throw ffErr_('AMOUNT', 'Dư nợ không được âm.');
    var orig = p.original_amount === undefined || p.original_amount === '' ? open : signed_(p.original_amount, 'Số tiền vay gốc');
    var term = p.term_months === undefined || p.term_months === '' ? '' : toNumber_(p.term_months, 'Kỳ hạn vay (tháng)');
    if (term !== '' && (term <= 0 || term > 1200)) throw ffErr_('LIAB', 'Kỳ hạn vay không hợp lệ.');
    var row = {
      liability_id: nextCode_('Liabilities', 'liability_id', 'D', 3), name: reqText_(p.name, 'Tên khoản vay', 2, 120),
      original_amount: orig, opening_balance: open, opening_date: ymd_(p.opening_date, 'Ngày bắt đầu'), status: 'active',
      term_months: term === '' ? '' : term
    };
    appendRows_('Liabilities', [row]);
    audit_('liability:create', row.liability_id, { name: row.name, opening: open, term_months: row.term_months });
    return { liability_id: row.liability_id };
  });
}

// Sửa tên / kỳ hạn vay. Không cho sửa original_amount/opening_balance/opening_date ở đây — những số
// đó đã khoá vào các bút toán đã ghi (sửa tay sẽ làm lệch dư nợ đã tính); cần đối soát dư nợ thì dùng
// loanAdjust (liability_adjustment) như hiện có.
function updateLiability_(m, p) {
  return withLock_(function () {
    var l = liabilityOrThrow_(p.liability_id);
    var patch = {};
    if (p.name !== undefined) patch.name = reqText_(p.name, 'Tên khoản vay', 2, 120);
    if (p.term_months !== undefined) {
      if (p.term_months === '' || p.term_months === null) patch.term_months = '';
      else {
        var term = toNumber_(p.term_months, 'Kỳ hạn vay (tháng)');
        if (term <= 0 || term > 1200) throw ffErr_('LIAB', 'Kỳ hạn vay không hợp lệ.');
        patch.term_months = term;
      }
    }
    updateRow_('Liabilities', l._row, patch);
    audit_('liability:update', l.liability_id, { before: { name: l.name, term_months: l.term_months }, patch: patch });
    return { liability_id: l.liability_id };
  });
}

// Lãi suất CHỈ để theo dõi — không dùng trong bất kỳ phép tính dư nợ/trả góp nào (theo yêu cầu của
// người dùng 07/11/2026). Mỗi lần đổi lãi suất là một dòng mới, không sửa đè dòng cũ, để giữ lịch sử.
function addLiabilityRate_(m, p) {
  return withLock_(function () {
    var l = liabilityOrThrow_(p.liability_id);
    var rate = pct_(p.rate_percent, 'Lãi suất (%)', 100);
    var row = {
      rate_id: nextCode_('LiabilityRates', 'rate_id', 'R', 3), liability_id: l.liability_id,
      effective_date: ymd_(p.effective_date, 'Ngày áp dụng'), rate_percent: rate, note: clip_(p.note, 200), created_at: nowIso_()
    };
    appendRows_('LiabilityRates', [row]);
    audit_('liability:rate', l.liability_id, { effective_date: row.effective_date, rate_percent: rate });
    return { rate_id: row.rate_id };
  });
}

function liabilityRates_(liabilityId) {
  return readAll_('LiabilityRates').filter(function (r) { return r.liability_id === liabilityId; })
    .sort(function (a, b) { return a.effective_date < b.effective_date ? -1 : a.effective_date > b.effective_date ? 1 : 0; });
}

// Lịch sử trả nợ của 1 khoản vay: từng giao dịch (trả nợ / điều chỉnh dư nợ / đảo bút toán) theo thứ
// tự thời gian, kèm dư nợ còn lại sau mỗi dòng.
function liabilityHistory_(liabilityId) {
  var st = buildState_(), l = st.liabs[liabilityId];
  if (!l) throw ffErr_('LIAB', 'Khoản vay không tồn tại.');
  var rows = readAll_('LiabilityEntries').filter(function (e) { return e.liability_id === liabilityId; }).map(function (e) {
    var t = st.txnMap[e.txn_id] || {};
    var ent = (st.entriesBy[e.txn_id] || [])[0];
    return {
      txn_id: e.txn_id, date: t.txn_date, kind: t.txn_kind, kind_label: FF_KINDS[t.txn_kind] || t.txn_kind,
      amount: e.amount, wallet_id: ent ? ent.wallet_id : '', wallet_name: ent && st.wallets[ent.wallet_id] ? st.wallets[ent.wallet_id].name : '',
      note: t.note || t.reason || '', reversed: !!st.reversedBy[e.txn_id]
    };
  }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.txn_id < b.txn_id ? -1 : 1); });
  var bal = l.opening_balance;
  rows.forEach(function (r) { bal += r.amount; r.balance_after = bal; });
  var remainingMonths = null;
  if (l.term_months) {
    var elapsed = monthsBetween_(l.opening_date, todayYmd_());
    remainingMonths = Math.max(l.term_months - elapsed, 0);
  }
  return {
    liability: { liability_id: l.liability_id, name: l.name, original_amount: l.original_amount, opening_balance: l.opening_balance, opening_date: l.opening_date, term_months: l.term_months || '', remaining_months: remainingMonths, balance: st.liabBal[liabilityId] },
    entries: rows, rates: liabilityRates_(liabilityId)
  };
}

// Số tháng tròn đã trôi qua từ "from" (yyyy-MM-dd) đến "to" — dùng để tính số tháng còn lại của kỳ
// hạn vay (chỉ theo dõi, không ảnh hưởng số liệu tài chính).
function monthsBetween_(from, to) {
  var a = from.split('-').map(Number), b = to.split('-').map(Number);
  var m = (b[0] - a[0]) * 12 + (b[1] - a[1]);
  if (b[2] < a[2]) m--;
  return Math.max(m, 0);
}

function liabilityBalances_() {
  var st = buildState_();
  return st.liabBal;
}

// Net worth = wallets (excluding held-in-trust) + assets at purchase price (not sold, active)
// + gold lots at purchase price (not sold, active, see Gold.gs)
// + personal receivables (nợ cá nhân người khác còn nợ gia đình) - liabilities (bank loans +
// personal payables, nợ cá nhân gia đình còn nợ người khác). Treating personal lend/borrow as a
// standard receivable/payable is the ordinary accounting default; flag it to the user if they'd
// rather see it broken out differently.
// Held-in-trust money is somebody else's: reported separately, never part of net worth (REQ-018).
function netWorth_() {
  var st = buildState_();
  var cash = 0, savings = 0, trust = 0;
  Object.keys(st.wallets).forEach(function (id) {
    var w = st.wallets[id], b = st.walletBal[id];
    if (w.wallet_type === 'held_in_trust') trust += b;
    else if (w.wallet_type === 'savings') savings += b;
    else cash += b;
  });
  var assets = 0;
  readAll_('Assets').forEach(function (a) {
    if (a.active === 1 && !st.assetSale[a.asset_id]) assets += a.purchase_value;
  });
  // Vàng (sổ riêng, xem Gold.gs) tính vào "tài sản" của tài sản ròng giống Assets — giá mua đã nhập,
  // không tự định giá lại. [GIẢ ĐỊNH — theo cùng quy tắc đã duyệt cho Assets, có thể điều chỉnh nếu
  // không đúng ý]
  assets += goldHoldingsValue_(st);
  var bankDebt = 0;
  Object.keys(st.liabs).forEach(function (id) { bankDebt += st.liabBal[id]; });
  var receivable = 0, payable = 0;
  Object.keys(st.debts).forEach(function (id) {
    var b = st.debtBal[id];
    if (st.debts[id].direction === 'lend') receivable += b; else payable += b;
  });
  var liabilities = bankDebt + payable;
  return {
    cash: cash, savings: savings, assets: assets, receivables: receivable, liabilities: liabilities,
    held_in_trust: trust, net_worth: cash + savings + assets + receivable - liabilities
  };
}

function assetsView_() {
  var st = buildState_();
  var assets = readAll_('Assets').map(function (a) {
    return { asset_id: a.asset_id, type: a.asset_type, type_label: FF_ASSET_TYPES[a.asset_type] || a.asset_type, name: a.name, purchase_value: a.purchase_value, purchase_date: a.purchase_date, note: a.note, active: a.active, sold: !!st.assetSale[a.asset_id], has_txn: assetHasTxn_(a.asset_id) };
  });
  // Total repaid per liability = payments made (net of reversed payments).
  var paid = {};
  readAll_('LiabilityEntries').forEach(function (e) {
    var t = st.txnMap[e.txn_id];
    if (!t) return;
    var isPay = t.txn_kind === 'loan_payment' ||
      (t.txn_kind === 'reversal' && st.txnMap[t.reverses_id] && st.txnMap[t.reverses_id].txn_kind === 'loan_payment');
    if (isPay) paid[e.liability_id] = (paid[e.liability_id] || 0) - e.amount;
  });
  var liabs = Object.keys(st.liabs).map(function (id) {
    var l = st.liabs[id];
    var remainingMonths = null;
    if (l.term_months) remainingMonths = Math.max(l.term_months - monthsBetween_(l.opening_date, todayYmd_()), 0);
    return { liability_id: id, name: l.name, original_amount: l.original_amount, opening_balance: l.opening_balance, opening_date: l.opening_date, term_months: l.term_months || '', remaining_months: remainingMonths, paid: paid[id] || 0, balance: st.liabBal[id] };
  });
  return { assets: assets, liabilities: liabs, summary: netWorth_() };
}
