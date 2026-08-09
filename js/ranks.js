// Rank list — order matches the club's official ranking (spec order 1..15)
const RANKS = [
  { code: "A-SA",   label: "مسؤول . ساموراي" },
  { code: "A-SAF",  label: "مسؤول . ساموراي سابق" },
  { code: "A",      label: "مسؤول" },
  { code: "S-SA",   label: "مشرف . ساموراي" },
  { code: "S-SAF",  label: "مشرف . ساموراي سابق" },
  { code: "S",      label: "مشرف" },
  { code: "AF-SA",  label: "مسؤول سابق . ساموراي" },
  { code: "SF-SA",  label: "مشرف سابق . ساموراي" },
  { code: "SA",     label: "ساموراي" },
  { code: "AF-SAF", label: "مسؤول سابق . ساموراي سابق" },
  { code: "SF-SAF", label: "مشرف سابق . ساموراي سابق" },
  { code: "AF",     label: "مسؤول سابق" },
  { code: "SF",     label: "مشرف سابق" },
  { code: "SAF",    label: "ساموراي سابق" },
  { code: "M",      label: "عضو" },
];

function rankLabel(code) {
  const r = RANKS.find(r => r.code === code);
  return r ? r.label : code;
}

// ranks whose registration form should show the "samurai facebook link" field
function rankHasSamuraiField(code) {
  return code.includes("SA") && !code.includes("SAF");
}

// ranks that are currently-active admin/supervisor/samurai and therefore
// need an initial password field when registering
function rankNeedsPassword(code) {
  return ["A-SA","A-SAF","A","S-SA","S-SAF","S","AF-SA","SF-SA","SA"].includes(code)
    && !code.startsWith("AF") && !code.startsWith("SF") ? true :
    ["A-SA","A-SAF","A","S-SA","S-SAF","S"].includes(code);
}
// Simpler, explicit rule matching the spec: password box shows only for
// ranks that are an *active* admin, supervisor, or samurai role.
function rankIsLoginCapable(code) {
  const loginCodes = ["A-SA","A-SAF","A","S-SA","S-SAF","S","AF-SA","SF-SA","SA"];
  return loginCodes.includes(code);
}

function statusLabel(status) {
  return { active: "نشط", frozen: "مجمد", banned: "محظور" }[status] || status;
}
