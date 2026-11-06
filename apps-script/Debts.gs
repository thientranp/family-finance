// Debts.gs - sổ nợ cá nhân (vay mượn người quen, khác với Liabilities = nợ ngân hàng).
// direction 'lend'  = gia đình cho người khác vay (receivable, người đó nợ gia đình).
// direction 'borrow' = gia đình vay của người khác (payable, gia đình nợ người đó).
// Không tính lãi suất (theo quyết định 06/11/2026): chỉ theo dõi gốc và đã trả/thu bao nhiêu.
var FF_V = FF_V || {};
FF_V.Debts = '0.1.0';

// Creates a new personal debt AND posts the matching wallet movement in one atomic step
// (unlike Liabilities, where createLiability_ only records a pre-existing balance and never
// touches a wallet) because the user's confirmed rule is: "cho vay -> trừ ví ngay,
// vay nợ -> cộng ví ngay", i.e. the debt only ever comes into existence together with real cash
// moving. Validates everything it can BEFORE writing the Debts row, to minimize the (already
// accepted-elsewhere, see createAsset_/createLiability_) risk of an orphan row if something later
// in the same call fails.
function svcDebtNew_(m, p) {
  var direction = p.direction === 'lend' ? 'lend' : (p.direction === 'borrow' ? 'borrow' : null);
  if (!direction) throw ffErr_('DEBT', 'Chiều nợ không hợp lệ.');
  return withLock_(function () {
    var st = buildState_();
    var key = p.key ? String(p.key) : '';
    if (key && st.keyMap[key]) return { debt_id: '', txn_id: st.keyMap[key], duplicate: true };
    var amt = amount_(p.amount);
    var date = ymd_(p.date, 'Ngày');
    activeWallet_(st, p.wallet_id); // throws before any write if the wallet is bad
    var counterparty = reqText_(p.counterparty, direction === 'lend' ? 'Tên người vay' : 'Tên người cho vay', 1, 120);
    var row = {
      debt_id: nextCode_('Debts', 'debt_id', 'N', 3), direction: direction, counterparty: counterparty,
      original_amount: amt, opening_date: date, note: clip_(p.note, 300)
    };
    appendRows_('Debts', [row]);
    st.debts[row.debt_id] = row; st.debtBal[row.debt_id] = 0;
    var r = planPost_(st, m.member_id, {
      kind: direction === 'lend' ? 'debt_lend' : 'debt_borrow',
      date: date, amount: amt, wallet_id: p.wallet_id, debt_id: row.debt_id, note: p.note, key: key
    });
    commitPlans_([r.plan]);
    audit_('debt:new', row.debt_id, { direction: direction, counterparty: counterparty, amount: amt });
    return { debt_id: row.debt_id, txn_id: r.txn_id, duplicate: false };
  });
}

function debtsView_() {
  var st = buildState_();
  var rows = readAll_('Debts').map(function (d) {
    var bal = st.debtBal[d.debt_id] || 0;
    return {
      debt_id: d.debt_id, direction: d.direction, counterparty: d.counterparty,
      original_amount: d.original_amount, opening_date: d.opening_date, note: d.note,
      balance: bal, status: bal > 0 ? 'active' : 'closed'
    };
  });
  rows.sort(function (a, b) { return (b.status === 'active') - (a.status === 'active') || (a.opening_date < b.opening_date ? 1 : -1); });
  var totalReceivable = 0, totalPayable = 0;
  rows.forEach(function (r) { if (r.direction === 'lend') totalReceivable += r.balance; else totalPayable += r.balance; });
  return { debts: rows, total_receivable: totalReceivable, total_payable: totalPayable };
}
