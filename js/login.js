function initLoginPage(role, roleLabel, redirectTo) {
  const form = document.getElementById("loginForm");
  const msgBox = document.getElementById("msgBox");
  const forgotLink = document.getElementById("forgotLink");
  const forgotModal = document.getElementById("forgotModal");

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
    forgotModal.style.display = "flex";
  });

  document.getElementById("forgotCancel").addEventListener("click", () => {
    forgotModal.style.display = "none";
  });

  document.getElementById("forgotSend").addEventListener("click", async () => {
    const code = document.getElementById("code").value.trim();
    if (!code) { alert("اكتب رمز العضوية أولاً في الحقل بالأعلى"); return; }
    const { error } = await sb.rpc("fn_request_password_reset", { p_code: code });
    document.getElementById("forgotBody").innerHTML = error
      ? `<div class="msg err">${error.message}</div>`
      : `<div class="msg info">تم إرسال إشعار إلى المسؤولين. يرجى التواصل مع أحد المسؤولين لتسليمك كلمة السر ثم تغييرها.</div>`;
    document.getElementById("forgotSend").style.display = "none";
  });
}
