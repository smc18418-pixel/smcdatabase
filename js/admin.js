const session = requireRole("admin");

document.addEventListener("DOMContentLoaded", async () => {
  if (!session) return;
  renderTopbar(session);
  maybeForceInitialPasswordChange(session);
  await loadPasswordResetNotices();

  document.getElementById("searchBtn").onclick = doSearch;
  document.getElementById("searchInput").addEventListener("keydown", e => { if (e.key === "Enter") doSearch(); });
  document.getElementById("viewAllBtn").onclick = showViewAll;
  document.getElementById("newMemberBtn").onclick = showRegisterForm;
});

async function loadPasswordResetNotices() {
  const { data, error } = await sb.rpc("fn_list_password_reset_requests", { p_token: session.token });
  const area = document.getElementById("notifyArea");
  if (error || !data || data.length === 0) { area.innerHTML = ""; return; }
  area.innerHTML = data.map(r => `
    <div class="notify-bar">
      العضو ( ${escapeHtml(r.membership_code)} ) نسي كلمة السر — الاسم: ${escapeHtml(r.name)}
      <br>
      <button class="btn secondary" style="width:auto;display:inline-block;margin-top:8px;padding:6px 12px;"
        onclick="resetMemberPassword('${r.membership_code}')">تسليم كلمة سر جديدة</button>
    </div>
  `).join("");
}

async function resetMemberPassword(code) {
  const newPass = prompt("اكتب كلمة السر المؤقتة الجديدة لهذا العضو:");
  if (!newPass) return;
  const { error } = await sb.rpc("fn_admin_reset_password", { p_token: session.token, p_target_code: code, p_new_password: newPass });
  if (error) { alert(error.message); return; }
  alert("تم تسليم كلمة سر جديدة. يرجى إخبار العضو بها ليقوم بتغييرها.");
  loadPasswordResetNotices();
}

async function doSearch() {
  const q = document.getElementById("searchInput").value.trim();
  const area = document.getElementById("resultArea");
  if (!q) { area.innerHTML = `<div class="msg err">اكتب الاسم أو رمز العضوية أولاً</div>`; return; }
  const { data, error } = await sb.rpc("fn_search_member", { p_token: session.token, p_query: q });
  if (error) { area.innerHTML = `<div class="msg err">${error.message}</div>`; return; }
  if (!data || data.length === 0) {
    area.innerHTML = `<div class="msg err">هذا العضو غير موجود في النظام</div>`;
    return;
  }
  showMemberDetail(data[0]);
}

function memberDetailTableHtml(m) {
  return `
    <div class="table-wrap">
    <table class="datatable">
      <tr><th>رمز العضوية</th><th>الاسم</th><th>رقم الهاتف</th><th>السكن</th></tr>
      <tr><td>${escapeHtml(m.membership_code)}</td><td>${escapeHtml(m.name)}</td><td>${escapeHtml(m.phone)}</td><td>${escapeHtml(m.residence)}</td></tr>
      <tr><th>الرتبة</th><th>تاريخ التسجيل</th><th>تاريخ انتهاء العضوية</th><th>الحالة</th></tr>
      <tr><td>${rankLabel(m.rank_code)}</td><td>${fmtDateShort(m.registered_at)}</td><td>${m.membership_expires_at ? fmtDateShort(m.membership_expires_at) : "دائمة"}</td><td>${statusBadge(m.status)}</td></tr>
      <tr><th colspan="2">رابط الفيسبوك</th><th colspan="2">رابط الساموراي</th></tr>
      <tr><td colspan="2" style="word-break:break-all;">${m.facebook_url ? `<a class="link" href="${escapeHtml(m.facebook_url)}" target="_blank">${escapeHtml(m.facebook_url)}</a>` : "—"}</td>
          <td colspan="2" style="word-break:break-all;">${m.samurai_url ? `<a class="link" href="${escapeHtml(m.samurai_url)}" target="_blank">${escapeHtml(m.samurai_url)}</a>` : "—"}</td></tr>
      <tr><th colspan="4">تم تسجيله بواسطة</th></tr>
      <tr><td colspan="4">${escapeHtml(m.registered_by_name || "—")} (${escapeHtml(m.registered_by_code || "—")})</td></tr>
    </table>
    </div>
  `;
}

function showMemberDetail(m) {
  const area = document.getElementById("resultArea");
  const isSelf = m.membership_code === session.member.membership_code;
  const isPermanent = !m.membership_expires_at;
  area.innerHTML = `
    <div class="card">
      ${memberDetailTableHtml(m)}
      <div class="grid-actions">
        <button class="btn" id="editBtn">تعديل البيانات</button>
        <button class="btn" id="rankBtn">ترقية / تنزيل</button>
        <button class="btn" id="certBtn">تنزيل الشهادة</button>
        <button class="btn" id="cardBtn">تنزيل البطاقة</button>
        ${isPermanent ? "" : `<button class="btn" id="renewBtn">تجديد العضوية</button>`}
        ${isSelf ? "" : `<button class="btn danger" id="banBtn">${m.status === "banned" ? "إلغاء الحظر" : "حظر"}</button>`}
      </div>
    </div>
  `;
  document.getElementById("editBtn").onclick = () => showEditForm(m);
  document.getElementById("rankBtn").onclick = () => showRankChangeForm(m);
  document.getElementById("certBtn").onclick = async () => {
    const url = await generateRegistrationCertificate(m);
    downloadDataUrl(url, `${m.membership_code}-شهادة.jpg`);
  };
  document.getElementById("cardBtn").onclick = async () => {
    const url = await generateCard(m);
    downloadDataUrl(url, `${m.membership_code}-بطاقة.jpg`);
  };
  if (!isPermanent) document.getElementById("renewBtn").onclick = () => doRenew(m);
  if (!isSelf) document.getElementById("banBtn").onclick = () => doBanToggle(m);
}

function doRenew(m) {
  confirmModal(`هل أنت متأكد من تجديد عضوية ${escapeHtml(m.name)} (${escapeHtml(m.membership_code)}) لمدة سنة أخرى؟`, async () => {
    const { data, error } = await sb.rpc("fn_renew_membership", { p_token: session.token, p_member_code: m.membership_code });
    if (error) { closeModal(); alert(error.message); return; }
    openModal(`
      <h3>تم تمديد عضوية هذا العضو إلى تاريخ ${fmtDateShort(data)}</h3>
      <button class="btn" id="okBack">رجوع</button>
    `);
    document.getElementById("okBack").onclick = () => { closeModal(); doSearch(); };
  });
}

function doBanToggle(m) {
  const willBan = m.status !== "banned";
  const title = willBan
    ? `هل أنت متأكد من رغبتك في حظر هذا العضو؟ (${escapeHtml(m.name)} - ${escapeHtml(m.membership_code)})`
    : `هل أنت متأكد من إلغاء حظر هذا العضو؟ (${escapeHtml(m.name)} - ${escapeHtml(m.membership_code)})`;
  confirmModal(title, async () => {
    const { data: newStatus, error } = await sb.rpc("fn_ban_toggle", { p_token: session.token, p_member_code: m.membership_code });
    if (error) { closeModal(); alert(error.message); return; }
    openModal(`
      <h3>${newStatus === "banned" ? "تم حظر هذا العضو" : "تم إلغاء حظر هذا العضو"}: ${escapeHtml(m.name)} — ${escapeHtml(m.membership_code)}</h3>
      <button class="btn" id="okBack">رجوع</button>
    `);
    document.getElementById("okBack").onclick = () => { closeModal(); doSearch(); };
  });
}

function showEditForm(m) {
  openModal(`
    <h3>تعديل بيانات العضو</h3>
    <div id="editMsg"></div>
    <label>الاسم</label><input type="text" id="eName" value="${escapeHtml(m.name)}">
    <label>رقم الهاتف</label><input type="tel" id="ePhone" value="${escapeHtml(m.phone)}">
    <label>السكن</label><input type="text" id="eResidence" value="${escapeHtml(m.residence)}">
    <label>رابط حساب الفيسبوك</label><input type="text" id="eFb" value="${escapeHtml(m.facebook_url || "")}">
    <label>رابط حساب الساموراي</label><input type="text" id="eSam" value="${escapeHtml(m.samurai_url || "")}">
    <div class="grid-actions">
      <button class="btn" id="eSave">حفظ</button>
      <button class="btn secondary" id="eCancel">رجوع</button>
    </div>
  `);
  document.getElementById("eCancel").onclick = closeModal;
  document.getElementById("eSave").onclick = async () => {
    const { data, error } = await sb.rpc("fn_edit_member", {
      p_token: session.token, p_member_code: m.membership_code,
      p_name: document.getElementById("eName").value.trim(),
      p_phone: document.getElementById("ePhone").value.trim(),
      p_residence: document.getElementById("eResidence").value.trim(),
      p_facebook: document.getElementById("eFb").value.trim(),
      p_samurai_url: document.getElementById("eSam").value.trim(),
    });
    if (error) { document.getElementById("editMsg").innerHTML = `<div class="msg err">${error.message}</div>`; return; }
    closeModal();
    showMemberDetail(data);
  };
}

function showRankChangeForm(m) {
  const isSelf = m.membership_code === session.member.membership_code;
  if (isSelf) { showSelfRankChangeForm(m); return; }

  const options = RANKS.map(r => `<option value="${r.code}" ${r.code === m.rank_code ? "selected" : ""}>${r.label} (${r.code})</option>`).join("");
  openModal(`
    <h3>ترقية / تنزيل</h3>
    <p style="color:#ccc;">الرتبة الحالية: <b>${rankLabel(m.rank_code)}</b></p>
    <div id="rankMsg"></div>
    <label>الرتبة الجديدة</label>
    <select id="newRank">${options}</select>
    <div id="rankPwField" style="display:none;">
      <label>إضافة كلمة سر أولية</label>
      <input type="password" id="rankInitialPw" placeholder="كلمة سر أولية لهذا العضو">
    </div>
    <div class="grid-actions">
      <button class="btn" id="rankSave">تنفيذ</button>
      <button class="btn secondary" id="rankCancel">رجوع</button>
    </div>
  `);
  const rankSelect = document.getElementById("newRank");
  const refreshPwField = () => {
    document.getElementById("rankPwField").style.display = rankIsLoginCapable(rankSelect.value) ? "block" : "none";
  };
  rankSelect.addEventListener("change", refreshPwField);
  refreshPwField();

  document.getElementById("rankCancel").onclick = closeModal;
  document.getElementById("rankSave").onclick = async () => {
    const newRank = rankSelect.value;
    const activeAdminRanks = ["A", "A-SA", "A-SAF"];
    const needsAdminApproval = activeAdminRanks.includes(m.rank_code) && !activeAdminRanks.includes(newRank);

    if (needsAdminApproval) {
      showAdminDemoteApprovalForm(m, newRank);
      return;
    }

    const initialPw = rankIsLoginCapable(newRank) ? document.getElementById("rankInitialPw").value : null;
    const { data, error } = await sb.rpc("fn_change_rank_with_password", {
      p_token: session.token, p_member_code: m.membership_code, p_new_rank_code: newRank, p_initial_password: initialPw
    });
    if (error) { document.getElementById("rankMsg").innerHTML = `<div class="msg err">${error.message}</div>`; return; }
    showRankChangeSuccess(data);
  };
}

// Demoting an active admin (A / A-SA / A-SAF) to supervisor-or-lower needs
// that admin's own consent: they must type their own membership code +
// password to confirm before the change is applied.
function showAdminDemoteApprovalForm(m, newRank) {
  openModal(`
    <h3>موافقة المسؤول المطلوب تنزيله</h3>
    <p style="color:#ccc;font-size:.85rem;">لا يمكن تنزيل هذا المسؤول إلا بموافقته. يرجى منه تأكيد رمز عضويته وكلمة السر.</p>
    <div id="apprMsg"></div>
    <label>رمز العضوية</label>
    <input type="text" id="apprCode" value="${escapeHtml(m.membership_code)}">
    <label>كلمة السر</label>
    <input type="password" id="apprPassword">
    <div class="grid-actions">
      <button class="btn" id="apprOk">موافق</button>
      <button class="btn secondary" id="apprCancel">تراجع</button>
    </div>
  `);
  document.getElementById("apprCancel").onclick = () => showRankChangeForm(m);
  document.getElementById("apprOk").onclick = async () => {
    const confirmCode = document.getElementById("apprCode").value.trim();
    const confirmPw = document.getElementById("apprPassword").value;
    const msg = document.getElementById("apprMsg");
    if (!confirmCode || !confirmPw) { msg.innerHTML = `<div class="msg err">يرجى تعبئة الحقلين</div>`; return; }
    const { data, error } = await sb.rpc("fn_admin_demote_with_approval", {
      p_token: session.token, p_member_code: m.membership_code, p_new_rank_code: newRank,
      p_confirm_code: confirmCode, p_confirm_password: confirmPw
    });
    if (error) { msg.innerHTML = `<div class="msg err">${error.message}</div>`; return; }
    showRankChangeSuccess(data);
  };
}

function showRankChangeSuccess(data) {
  openModal(`
    <h3>تم تغيير رتبة العضو بنجاح</h3>
    <p>رمز العضوية الجديد: <b>${escapeHtml(data.membership_code)}</b></p>
    <div class="grid-actions">
      <button class="btn" id="dlCert">تنزيل الشهادة</button>
      <button class="btn" id="dlCard">تنزيل البطاقة</button>
    </div>
    <button class="btn secondary" id="rankBack" style="margin-top:10px;">رجوع</button>
  `);
  document.getElementById("dlCert").onclick = async () => {
    const url = await generateRankChangeCertificate(data, session.member.name, session.member.membership_code);
    downloadDataUrl(url, `${data.membership_code}-شهادة-ترقية.jpg`);
  };
  document.getElementById("dlCard").onclick = async () => {
    const url = await generateCard(data);
    downloadDataUrl(url, `${data.membership_code}-بطاقة.jpg`);
  };
  document.getElementById("rankBack").onclick = () => { closeModal(); doSearch(); };
}

// Admin changing their OWN rank: warn about losing access, confirm with
// password, then show success with cert/card download + a logout button.
function showSelfRankChangeForm(m) {
  const options = RANKS.map(r => `<option value="${r.code}" ${r.code === m.rank_code ? "selected" : ""}>${r.label} (${r.code})</option>`).join("");
  openModal(`
    <h3>ترقية / تنزيل رتبتك</h3>
    <p style="color:#ccc;">الرتبة الحالية: <b>${rankLabel(m.rank_code)}</b></p>
    <div id="rankMsg"></div>
    <label>الرتبة الجديدة</label>
    <select id="newRank">${options}</select>
    <div class="grid-actions">
      <button class="btn" id="rankNext">تنفيذ</button>
      <button class="btn secondary" id="rankCancel">رجوع</button>
    </div>
  `);
  document.getElementById("rankCancel").onclick = closeModal;
  document.getElementById("rankNext").onclick = () => {
    const newRank = document.getElementById("newRank").value;
    confirmModal("لن تستطيع الدخول لحسابك بعد تغيير الرتبة . هل أنت متأكد أنك ترغب في الإستمرار ؟", () => {
      showSelfRankPasswordConfirm(m, newRank);
    });
  };
}

function showSelfRankPasswordConfirm(m, newRank) {
  openModal(`
    <h3>أكتب كلمة السر</h3>
    <div id="selfPwMsg"></div>
    <input type="password" id="selfPw">
    <div class="grid-actions">
      <button class="btn" id="selfPwOk">موافق</button>
      <button class="btn secondary" id="selfPwBack">تراجع</button>
    </div>
  `);
  document.getElementById("selfPwBack").onclick = () => showSelfRankChangeForm(m);
  document.getElementById("selfPwOk").onclick = async () => {
    const pw = document.getElementById("selfPw").value;
    const msg = document.getElementById("selfPwMsg");
    if (!pw) { msg.innerHTML = `<div class="msg err">اكتب كلمة السر</div>`; return; }
    const { data, error } = await sb.rpc("fn_self_change_rank", { p_token: session.token, p_new_rank_code: newRank, p_password: pw });
    if (error) { msg.innerHTML = `<div class="msg err">${error.message}</div>`; return; }
    openModal(`
      <h3>تم تغيير رتبتك بنجاح . رمز العضوية الجديد ${escapeHtml(data.membership_code)}</h3>
      <div class="grid-actions">
        <button class="btn" id="dlCert">تنزيل الشهادة</button>
        <button class="btn" id="dlCard">تنزيل البطاقة</button>
      </div>
      <button class="btn danger" id="selfLogout" style="margin-top:10px;">خروج</button>
    `);
    document.getElementById("dlCert").onclick = async () => {
      const url = await generateRankChangeCertificate(data, session.member.name, session.member.membership_code);
      downloadDataUrl(url, `${data.membership_code}-شهادة-ترقية.jpg`);
    };
    document.getElementById("dlCard").onclick = async () => {
      const url = await generateCard(data);
      downloadDataUrl(url, `${data.membership_code}-بطاقة.jpg`);
    };
    document.getElementById("selfLogout").onclick = () => {
      clearSession();
      window.location.href = "index.html";
    };
  };
}

function showRegisterForm() {
  const options = RANKS.map(r => `<option value="${r.code}">${r.label} (${r.code})</option>`).join("");
  const area = document.getElementById("resultArea");
  area.innerHTML = `
    <div class="card">
      <h3>تسجيل عضو جديد</h3>
      <div id="regMsg"></div>
      <label>الاسم</label><input type="text" id="rName">
      <label>رقم الهاتف</label><input type="tel" id="rPhone">
      <label>السكن</label><input type="text" id="rResidence">
      <label>الرتبة</label>
      <select id="rRank">${options}</select>
      <label>رابط حساب الفيسبوك</label><input type="text" id="rFb">
      <div id="samuraiField" style="display:none;">
        <label>رابط حساب الساموراي</label><input type="text" id="rSam">
      </div>
      <div id="passwordField" style="display:none;">
        <label>كلمة السر الأولية</label><input type="password" id="rPass">
      </div>
      <div class="grid-actions">
        <button class="btn" id="regSave">تسجيل</button>
        <button class="btn secondary" id="regCancel">رجوع</button>
      </div>
    </div>
  `;
  const rankSelect = document.getElementById("rRank");
  const refreshFields = () => {
    const code = rankSelect.value;
    document.getElementById("samuraiField").style.display = rankHasSamuraiField(code) ? "block" : "none";
    document.getElementById("passwordField").style.display = rankIsLoginCapable(code) ? "block" : "none";
  };
  rankSelect.addEventListener("change", refreshFields);
  refreshFields();

  document.getElementById("regCancel").onclick = () => { area.innerHTML = ""; };
  document.getElementById("regSave").onclick = async () => {
    const name = document.getElementById("rName").value.trim();
    const phone = document.getElementById("rPhone").value.trim();
    const residence = document.getElementById("rResidence").value.trim();
    const rank = rankSelect.value;
    const fb = document.getElementById("rFb").value.trim();
    const sam = rankHasSamuraiField(rank) ? document.getElementById("rSam").value.trim() : null;
    const pass = rankIsLoginCapable(rank) ? document.getElementById("rPass").value : null;
    const msg = document.getElementById("regMsg");
    if (!name || !phone || !residence) { msg.innerHTML = `<div class="msg err">يرجى تعبئة كل الحقول</div>`; return; }

    const { data, error } = await sb.rpc("fn_register_member", {
      p_token: session.token, p_name: name, p_phone: phone, p_residence: residence,
      p_rank_code: rank, p_facebook: fb, p_samurai_url: sam, p_initial_password: pass
    });
    if (error) { msg.innerHTML = `<div class="msg err">${error.message}</div>`; return; }

    area.innerHTML = `
      <div class="card">
        <h3>تم تسجيل العضو بنجاح تحت رمز العضوية ( ${escapeHtml(data.membership_code)} )</h3>
        <div class="grid-actions">
          <button class="btn" id="dlCert">تنزيل الشهادة</button>
          <button class="btn" id="dlCard">تنزيل البطاقة</button>
        </div>
      </div>
    `;
    document.getElementById("dlCert").onclick = async () => {
      const url = await generateRegistrationCertificate(data);
      downloadDataUrl(url, `${data.membership_code}-شهادة.jpg`);
    };
    document.getElementById("dlCard").onclick = async () => {
      const url = await generateCard(data);
      downloadDataUrl(url, `${data.membership_code}-بطاقة.jpg`);
    };
  };
}

async function showViewAll() {
  const area = document.getElementById("resultArea");
  const { data, error } = await sb.rpc("fn_list_all", { p_token: session.token });
  if (error) { area.innerHTML = `<div class="msg err">${error.message}</div>`; return; }
  area.innerHTML = `
    <div class="card">
      <div class="table-wrap">
      <table class="datatable" id="allTable">
        <tr><th>رمز العضوية</th><th>الاسم</th><th>رقم الهاتف</th><th>السكن</th><th>تاريخ التسجيل</th><th>تاريخ الانتهاء</th><th>الحالة</th></tr>
        ${data.map(m => `
          <tr class="memberRow" data-code="${escapeHtml(m.membership_code)}" style="cursor:pointer;">
            <td>${escapeHtml(m.membership_code)}</td>
            <td>${escapeHtml(m.name)}</td>
            <td>${escapeHtml(m.phone)}</td>
            <td>${escapeHtml(m.residence)}</td>
            <td>${fmtDateShort(m.registered_at)}</td>
            <td>${m.membership_expires_at ? fmtDateShort(m.membership_expires_at) : "دائمة"}</td>
            <td>${statusBadge(m.status)}</td>
          </tr>`).join("")}
      </table>
      </div>
      <button class="btn secondary" id="allBack" style="margin-top:14px;">رجوع</button>
    </div>
  `;
  document.getElementById("allBack").onclick = () => { area.innerHTML = ""; };
  document.querySelectorAll(".memberRow").forEach(row => {
    row.onclick = () => {
      const found = data.find(m => m.membership_code === row.dataset.code);
      if (found) showMemberDetail(found);
    };
  });
}
