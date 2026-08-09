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
      <button id="btnSecurityQ">تغيير اسئلة الأمان</button>
      <button id="btnLogout">تسجيل الخروج</button>
    </div>
  `;
  document.getElementById("btnLogout").onclick = () => {
    clearSession();
    window.location.href = "index.html";
  };
  document.getElementById("btnChangePw").onclick = openChangePasswordModal;
  document.getElementById("btnSecurityQ").onclick = openSecurityQuestionsModal;
}

// Forced password change on first login with an admin-assigned initial
// password. No "current password" field — the just-used temp password
// already proved who they are via the session token.
function maybeForceInitialPasswordChange(session) {
  if (!session || !session.member || !session.member.must_change_password) return;
  openModal(`
    <h3>تغيير كلمة السر</h3>
    <p style="color:#ccc;font-size:.85rem;">هذه كلمة سر أولية، يجب تغييرها قبل الاستمرار.</p>
    <div id="ipMsg"></div>
    <label>اكتب كلمة السر الجديدة</label>
    <input type="password" id="ipNew">
    <label>اعد كتابة كلمة السر الجديدة</label>
    <input type="password" id="ipConfirm">
    <button class="btn" id="ipOk" style="margin-top:14px;">موافق</button>
  `);
  document.getElementById("ipOk").onclick = async () => {
    const p1 = document.getElementById("ipNew").value;
    const p2 = document.getElementById("ipConfirm").value;
    const msg = document.getElementById("ipMsg");
    if (!p1 || p1 !== p2) { msg.innerHTML = `<div class="msg err">كلمتا السر غير متطابقتين</div>`; return; }
    const { error } = await sb.rpc("fn_set_initial_password", { p_token: session.token, p_new_password: p1 });
    if (error) { msg.innerHTML = `<div class="msg err">${error.message}</div>`; return; }
    session.member.must_change_password = false;
    saveSession(session.token, session.member);
    openModal(`
      <h3>تم تغيير كلمة السر بنجاح</h3>
      <button class="btn" id="ipDone">موافق</button>
    `);
    document.getElementById("ipDone").onclick = closeModal;
  };
}

const SECURITY_QUESTION_SETS = [
  ["ما اسم الشارع الذي نشأت فيه ؟", "ما اسم أول معلم أو معلمة لك في المدرسة ؟", "أين ولدت والدتك ؟"],
  ["ما هو لقبك في مرحلة الطفولة ؟", "ما إسم صديقك المفضل في مرحلة الطفولة ؟", "ما هي الوظيفة التي كنت تحلم بها و أنت صغير ؟"],
  ["ما نوع و طراز سيارتك الأولى ؟", "ما هي أول مدينة خارج بلدك قمت بزيارتها ؟", "ما إسم أول حيوان أليف إمتلكته ؟"],
];

function openSecurityQuestionsModal() {
  const session = getSession();
  openModal(`
    <h3>تغيير اسئلة الأمان</h3>
    <p style="color:#ccc;font-size:.85rem;">اكتب كلمة السر خاصتك</p>
    <div id="sqMsg"></div>
    <input type="password" id="sqPassword">
    <div class="grid-actions">
      <button class="btn" id="sqOk">موافق</button>
      <button class="btn secondary" id="sqCancel">رجوع</button>
    </div>
  `);
  document.getElementById("sqCancel").onclick = closeModal;
  document.getElementById("sqOk").onclick = async () => {
    const pass = document.getElementById("sqPassword").value;
    const msg = document.getElementById("sqMsg");
    if (!pass) { msg.innerHTML = `<div class="msg err">اكتب كلمة السر</div>`; return; }
    const { data: ok, error } = await sb.rpc("fn_verify_own_password", { p_token: session.token, p_password: pass });
    if (error || !ok) { msg.innerHTML = `<div class="msg err">كلمة السر غير صحيحة</div>`; return; }
    openSecurityQuestionsForm(session);
  };
}

function questionOptions(setIndex, selectedIndex) {
  return SECURITY_QUESTION_SETS[setIndex].map((q, i) =>
    `<option value="${i}" ${i === selectedIndex ? "selected" : ""}>${escapeHtml(q)}</option>`
  ).join("");
}

function openSecurityQuestionsForm(session) {
  openModal(`
    <h3>اسئلة الأمان</h3>
    <div id="sqfMsg"></div>
    <label>السؤال الأول</label>
    <select id="sq1">${questionOptions(0, 0)}</select>
    <input type="text" id="sa1" placeholder="الإجابة" style="margin-top:8px;">
    <label>السؤال الثاني</label>
    <select id="sq2">${questionOptions(1, 0)}</select>
    <input type="text" id="sa2" placeholder="الإجابة" style="margin-top:8px;">
    <label>السؤال الثالث</label>
    <select id="sq3">${questionOptions(2, 0)}</select>
    <input type="text" id="sa3" placeholder="الإجابة" style="margin-top:8px;">
    <div class="grid-actions">
      <button class="btn" id="sqfSend">إرسال</button>
      <button class="btn secondary" id="sqfCancel">رجوع</button>
    </div>
  `);
  document.getElementById("sqfCancel").onclick = closeModal;
  document.getElementById("sqfSend").onclick = async () => {
    const q1 = SECURITY_QUESTION_SETS[0][document.getElementById("sq1").value];
    const q2 = SECURITY_QUESTION_SETS[1][document.getElementById("sq2").value];
    const q3 = SECURITY_QUESTION_SETS[2][document.getElementById("sq3").value];
    const a1 = document.getElementById("sa1").value.trim();
    const a2 = document.getElementById("sa2").value.trim();
    const a3 = document.getElementById("sa3").value.trim();
    const msg = document.getElementById("sqfMsg");
    if (!a1 || !a2 || !a3) { msg.innerHTML = `<div class="msg err">يرجى الإجابة على جميع الأسئلة</div>`; return; }
    const { error } = await sb.rpc("fn_set_security_questions", {
      p_token: session.token, p_q1: q1, p_a1: a1, p_q2: q2, p_a2: a2, p_q3: q3, p_a3: a3
    });
    if (error) { msg.innerHTML = `<div class="msg err">${error.message}</div>`; return; }
    openModal(`
      <h3>تم تغيير اسئلة الأمان الخاصة بك</h3>
      <button class="btn" id="sqfBack">رجوع</button>
    `);
    document.getElementById("sqfBack").onclick = closeModal;
  };
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
