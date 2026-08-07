function fmtDateShort(d) {
  if (!d) return "لا يوجد";
  const dt = new Date(d);
  return dt.toLocaleDateString("ar-EG", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function renderTopbar(session, opts = {}) {
  const m = session.member;
  document.getElementById("topbar").innerHTML = `
    <div class="who">
      <img src="assets/logo.jpg" alt="">
      <div class="meta">
        <b>${escapeHtml(m.name)}</b><br>
        ${rankLabel(m.rank_code)} — ${escapeHtml(m.membership_code)}
      </div>
    </div>
    <div class="actions">
      <button id="btnChangePw">تغيير كلمة السر</button>
      <button id="btnLogout">تسجيل الخروج</button>
    </div>
  `;
  document.getElementById("btnLogout").onclick = () => {
    clearSession();
    window.location.href = "index.html";
  };
  document.getElementById("btnChangePw").onclick = openChangePasswordModal;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}

function openModal(html) {
  closeModal();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "activeModal";
  overlay.innerHTML = `<div class="modal">${html}</div>`;
  document.body.appendChild(overlay);
  return overlay;
}
function closeModal() {
  const existing = document.getElementById("activeModal");
  if (existing) existing.remove();
}

function openChangePasswordModal() {
  const session = getSession();
  openModal(`
    <h3>تغيير كلمة السر</h3>
    <div id="pwMsg"></div>
    <label>كلمة السر الحالية</label>
    <input type="password" id="pwOld">
    <label>كلمة السر الجديدة</label>
    <input type="password" id="pwNew">
    <label>تأكيد كلمة السر الجديدة</label>
    <input type="password" id="pwConfirm">
    <div class="grid-actions">
      <button class="btn" id="pwOk">موافق</button>
      <button class="btn secondary" id="pwCancel">رجوع</button>
    </div>
  `);
  document.getElementById("pwCancel").onclick = closeModal;
  document.getElementById("pwOk").onclick = async () => {
    const oldP = document.getElementById("pwOld").value;
    const newP = document.getElementById("pwNew").value;
    const conf = document.getElementById("pwConfirm").value;
    const msg = document.getElementById("pwMsg");
    if (!oldP || !newP || !conf) { msg.innerHTML = `<div class="msg err">يرجى تعبئة جميع الحقول</div>`; return; }
    if (newP !== conf) { msg.innerHTML = `<div class="msg err">كلمة السر الجديدة غير متطابقة</div>`; return; }
    const { error } = await sb.rpc("fn_change_password", { p_token: session.token, p_old: oldP, p_new: newP });
    if (error) { msg.innerHTML = `<div class="msg err">${error.message}</div>`; return; }
    openModal(`
      <h3>تم تغيير كلمة السر بنجاح</h3>
      <button class="btn" id="backOk">رجوع</button>
    `);
    document.getElementById("backOk").onclick = closeModal;
  };
}

function statusBadge(status) {
  const cls = { active: "status-active", frozen: "status-frozen", banned: "status-banned" }[status] || "";
  return `<span class="status-badge ${cls}">${statusLabel(status)}</span>`;
}

function confirmModal(title, onYes) {
  openModal(`
    <h3>${title}</h3>
    <div class="grid-actions">
      <button class="btn danger" id="cfYes">نعم</button>
      <button class="btn secondary" id="cfNo">لا</button>
    </div>
  `);
  document.getElementById("cfNo").onclick = closeModal;
  document.getElementById("cfYes").onclick = onYes;
}
