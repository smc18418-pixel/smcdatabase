function initLoginPage(role, roleLabel, redirectTo) {
  const form = document.getElementById("loginForm");
  const msgBox = document.getElementById("msgBox");
  const forgotLink = document.getElementById("forgotLink");
  const forgotModal = document.getElementById("forgotModal");
  const forgotModalBox = forgotModal.querySelector(".modal");

  function showMsg(text, kind = "err") {
    msgBox.innerHTML = `<div class="msg ${kind}">${text}</div>`;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msgBox.innerHTML = "";
    const code = document.getElementById("code").value.trim();
    const password = document.getElementById("password").value;
    if (!code || !password) { showMsg("يرجى إدخال رمز العضوية وكلمة السر"); return; }

    const submitBtn = form.querySelector("button[type=submit]");
    submitBtn.disabled = true;

    const { data, error } = await sb.rpc("fn_login", { p_code: code, p_password: password, p_role: role });
    submitBtn.disabled = false;

    if (error) { showMsg(error.message || "تعذر تسجيل الدخول"); return; }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) { showMsg("تعذر تسجيل الدخول"); return; }

    saveSession(row.session_token, row.member);
    window.location.href = redirectTo;
  });

  forgotLink.addEventListener("click", (e) => {
    e.preventDefault();
    renderForgotStep1();
    forgotModal.style.display = "flex";
  });

  function closeForgot() { forgotModal.style.display = "none"; }

  // -------- step 1: ask for membership code, fetch the 3 saved questions --
  function renderForgotStep1() {
    forgotModalBox.innerHTML = `
      <h3>نسيت كلمة السر؟</h3>
      <div id="fgMsg"></div>
      <label>رمز العضوية</label>
      <input type="text" id="fgCode" value="${(document.getElementById("code").value || "").trim()}">
      <div class="grid-actions">
        <button class="btn danger" id="fgNext">موافق</button>
        <button class="btn secondary" id="fgCancel">رجوع</button>
      </div>
    `;
    document.getElementById("fgCancel").onclick = closeForgot;
    document.getElementById("fgNext").onclick = async () => {
      const code = document.getElementById("fgCode").value.trim();
      const msg = document.getElementById("fgMsg");
      if (!code) { msg.innerHTML = `<div class="msg err">اكتب رمز العضوية</div>`; return; }
      const { data, error } = await sb.rpc("fn_get_security_questions", { p_code: code });
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row) {
        msg.innerHTML = `<div class="msg err">لا توجد أسئلة أمان مسجلة لهذا الحساب. يرجى التواصل مع أحد المسؤولين.</div>`;
        return;
      }
      renderForgotStep2(code, row);
    };
  }

  // -------- step 2: show the 3 questions with answer boxes -----------------
  function renderForgotStep2(code, qrow) {
    forgotModalBox.innerHTML = `
      <h3>أسئلة الأمان</h3>
      <div id="fgMsg"></div>
      <label>${escapeHtmlSafe(qrow.q1)}</label>
      <input type="text" id="fgA1">
      <label>${escapeHtmlSafe(qrow.q2)}</label>
      <input type="text" id="fgA2">
      <label>${escapeHtmlSafe(qrow.q3)}</label>
      <input type="text" id="fgA3">
      <div class="grid-actions">
        <button class="btn danger" id="fgCheck">موافق</button>
        <button class="btn secondary" id="fgCancel">رجوع</button>
      </div>
    `;
    document.getElementById("fgCancel").onclick = closeForgot;
    document.getElementById("fgCheck").onclick = async () => {
      const a1 = document.getElementById("fgA1").value.trim();
      const a2 = document.getElementById("fgA2").value.trim();
      const a3 = document.getElementById("fgA3").value.trim();
      const msg = document.getElementById("fgMsg");
      const { data: ticket, error } = await sb.rpc("fn_verify_security_answers", { p_code: code, p_a1: a1, p_a2: a2, p_a3: a3 });
      if (error || !ticket) {
        msg.innerHTML = `<div class="msg err">الإجابات غير صحيحة . حاول مرة أخرى</div>`;
        return;
      }
      renderForgotStep3(ticket);
    };
  }

  // -------- step 3: set the new password ------------------------------------
  function renderForgotStep3(ticket) {
    forgotModalBox.innerHTML = `
      <h3>تغيير كلمة السر</h3>
      <div id="fgMsg"></div>
      <label>اكتب كلمة السر الجديدة</label>
      <input type="password" id="fgNew">
      <label>اعد كتابة كلمة السر الجديدة</label>
      <input type="password" id="fgNew2">
      <div class="grid-actions">
        <button class="btn danger" id="fgSet">موافق</button>
        <button class="btn secondary" id="fgCancel">رجوع</button>
      </div>
    `;
    document.getElementById("fgCancel").onclick = closeForgot;
    document.getElementById("fgSet").onclick = async () => {
      const p1 = document.getElementById("fgNew").value;
      const p2 = document.getElementById("fgNew2").value;
      const msg = document.getElementById("fgMsg");
      if (!p1 || p1 !== p2) { msg.innerHTML = `<div class="msg err">كلمتا السر غير متطابقتين</div>`; return; }
      const { error } = await sb.rpc("fn_reset_password_with_ticket", { p_ticket: ticket, p_new_password: p1 });
      if (error) { msg.innerHTML = `<div class="msg err">${error.message}</div>`; return; }
      forgotModalBox.innerHTML = `
        <h3>تم تغيير كلمة السر بنجاح</h3>
        <button class="btn" id="fgDone">موافق</button>
      `;
      document.getElementById("fgDone").onclick = () => { closeForgot(); };
    };
  }
}

function escapeHtmlSafe(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
