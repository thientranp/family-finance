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

function createLiability_(m, p) {
  return withLock_(function () {
    var open = signed_(p.opening_balance, 'Dư nợ ban đầu');
    if (open < 0) throw ffErr_('AMOUNT', 'Dư nợ không được âm.');
    var orig = p.original_amount === undefined || p.original_amount === '' ? open : signed_(p.original_amount, 'Số tiền vay gốc');
    var row = {
      liability_id: nextCode_('Liabilities', 'liability_id', 'D', 3), name: reqText_(p.name, 'Tên khoản vay', 2, 120),
      original_amount: orig, opening_balance: open, opening_date: ymd_(p.opening_date, 'Ngày bắt đầu'), status: 'active'
    };
    appendRows_('Liabilities', [row]);
    audit_('liability:create', row.liability_id, { name: row.name, opening: open });
    return { liability_id: row.liability_id };
  });
}

function liabilityBalances_() {
  var st = buildState_();
  return st.liabBal;
}

// Net worth = wallets (excluding held-in-trust) + assets at purchase price (not sold, active)
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
    return { liability_id: id, name: l.name, original_amount: l.original_amount, opening_balance: l.opening_balance, opening_date: l.opening_date, paid: paid[id] || 0, balance: st.liabBal[id] };
  });
  return { assets: assets, liabilities: liabs, summary: netWorth_() };
}
