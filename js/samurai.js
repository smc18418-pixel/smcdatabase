const session = requireRole("samurai");

document.addEventListener("DOMContentLoaded", () => {
  if (!session) return;
  renderTopbar(session);
  maybeForceInitialPasswordChange(session);
  document.getElementById("searchBtn").onclick = doSearch;
  document.getElementById("searchInput").addEventListener("keydown", e => { if (e.key === "Enter") doSearch(); });
  document.getElementById("viewAllBtn").onclick = showViewAll;
});

async function doSearch() {
  const q = document.getElementById("searchInput").value.trim();
  const area = document.getElementById("resultArea");
  if (!q) { area.innerHTML = `<div class="msg err">اكتب الاسم أو رمز العضوية أولاً</div>`; return; }
  const { data, error } = await sb.rpc("fn_search_member", { p_token: session.token, p_query: q });
  if (error) { area.innerHTML = `<div class="msg err">${error.message}</div>`; return; }
  if (!data || data.length === 0) { area.innerHTML = `<div class="msg err">هذا العضو غير موجود في النظام</div>`; return; }
  const m = data[0];
  area.innerHTML = `
    <div class="card">
      <div class="table-wrap">
      <table class="datatable">
        <tr><th>رمز العضوية</th><th>الاسم</th><th>رقم الهاتف</th><th>السكن</th></tr>
        <tr><td>${escapeHtml(m.membership_code)}</td><td>${escapeHtml(m.name)}</td><td>${escapeHtml(m.phone)}</td><td>${escapeHtml(m.residence)}</td></tr>
        <tr><th>تاريخ التسجيل</th><th colspan="3">الحالة</th></tr>
        <tr><td>${fmtDateShort(m.registered_at)}</td><td colspan="3">${statusBadge(m.status)}</td></tr>
      </table>
      </div>
    </div>
  `;
}

async function showViewAll() {
  const area = document.getElementById("resultArea");
  const { data, error } = await sb.rpc("fn_list_all", { p_token: session.token });
  if (error) { area.innerHTML = `<div class="msg err">${error.message}</div>`; return; }
  area.innerHTML = `
    <div class="card">
      <div class="table-wrap">
      <table class="datatable">
        <tr><th>رمز العضوية</th><th>الاسم</th><th>رقم الهاتف</th><th>السكن</th><th>تاريخ التسجيل</th><th>الحالة</th></tr>
        ${data.map(m => `
          <tr>
            <td>${escapeHtml(m.membership_code)}</td>
            <td>${escapeHtml(m.name)}</td>
            <td>${escapeHtml(m.phone)}</td>
            <td>${escapeHtml(m.residence)}</td>
            <td>${fmtDateShort(m.registered_at)}</td>
            <td>${statusBadge(m.status)}</td>
          </tr>`).join("")}
      </table>
      </div>
      <button class="btn secondary" id="allBack" style="margin-top:14px;">رجوع</button>
    </div>
  `;
  document.getElementById("allBack").onclick = () => { area.innerHTML = ""; };
}
