async function login() {
  const role = document.getElementById("role").value;
  const code = document.getElementById("membership_code").value;
  const password = document.getElementById("password").value;

  let { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("membership_code", code)
    .eq("password", password)
    .single();

  if (error || !data) {
    document.getElementById("error").innerText = "خطأ في تسجيل الدخول";
    return;
  }

  if (data.status !== "نشط") {
    document.getElementById("error").innerText = "عضويتك غير نشطة";
    return;
  }

  document.getElementById("login-container").classList.add("hidden");
  document.getElementById("dashboard").classList.remove("hidden");
  document.getElementById("welcome").innerText =
    `مرحباً ${data.full_name} - ${data.membership_code}`;

  if (role === "admin") {
    document.getElementById("actions").innerHTML = `
      <button onclick="registerMember()">تسجيل عضو جديد</button>
      <button onclick="searchMember()">بحث عن عضو</button>
      <button onclick="updateMember()">تعديل بيانات</button>
      <button onclick="upgradeMember()">ترقية عضو</button>
      <button onclick="banMember()">حظر عضو</button>
      <button onclick="renewMember()">تجديد عضوية</button>
    `;
  } else {
    document.getElementById("actions").innerHTML = `
      <button onclick="searchMember()">بحث عن عضو</button>
    `;
  }
}

function logout() {
  document.getElementById("dashboard").classList.add("hidden");
  document.getElementById("login-container").classList.remove("hidden");
}