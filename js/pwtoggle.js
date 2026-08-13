// Adds a show/hide "eye" button to every <input type="password"> inside
// `root` (defaults to the whole document) that doesn't already have one.
// Safe to call repeatedly — already-wired inputs are skipped.
function wirePasswordToggles(root) {
  (root || document).querySelectorAll('input[type="password"]').forEach((inp) => {
    if (inp.dataset.pwWired) return;
    inp.dataset.pwWired = "1";

    const wrap = document.createElement("span");
    wrap.className = "pw-wrap";
    inp.parentNode.insertBefore(wrap, inp);
    wrap.appendChild(inp);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pw-eye";
    btn.textContent = "👁";
    btn.setAttribute("aria-label", "إظهار كلمة السر");
    btn.onclick = () => {
      const showing = inp.type === "text";
      inp.type = showing ? "password" : "text";
      btn.textContent = showing ? "👁" : "🙈";
    };
    wrap.appendChild(btn);
  });
}
