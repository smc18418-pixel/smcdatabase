// ============================================================================
// Certificate / Card generator.
// Draws text onto the club's existing JPG templates using <canvas>, then
// exports a JPG. Coordinates below were measured directly off the templates
// you supplied (assets/cert_register_template.jpg, cert_rank_template.jpg,
// card_template.jpg) using a pixel grid. They're best-effort: open a
// generated certificate, and if any field sits a few px off, tweak the
// matching x/y numbers in COORDS below — everything else stays the same.
// Font: Arial Bold everywhere, as requested.
// ============================================================================

const FONT_FAMILY = "'Arial', 'Tahoma', sans-serif";

const COORDS = {
  register: {
    image: "assets/cert_register_template.jpg",
    name:       { x: 1600, y: 1650, maxW: 4600, size: 200, align: "center" },
    rank:       { x: 2500, y: 1850, maxW: 5600,  size: 88 , align: "right"  },
    date:       { x: 230,  y: 1850, maxW: 400,  size: 40, align: "right"  },
    code:       { x: 1900, y: 1935, maxW: 620,  size: 44, align: "right"  },
    duration:   { x: 1400, y: 2090, maxW: 700,  size: 42, align: "right"  },
    registeredByName: { x: 2020, y: 3640, maxW: 900, size: 40, align: "right" },
    registeredByCode: { x: 2020, y: 3750, maxW: 900, size: 40, align: "right" },
    footerDate: { x: 2870, y: 4470, maxW: 700, size: 38, align: "right" },
  },
  rankChange: {
    image: "assets/cert_rank_template.jpg",
    name:       { x: 1654, y: 1650, maxW: 2300, size: 62, align: "center" },
    newRank:    { x: 1830, y: 1850, maxW: 700,  size: 44, align: "right"  },
    date:       { x: 230,  y: 1850, maxW: 400,  size: 40, align: "right"  },
    code:       { x: 1900, y: 1935, maxW: 620,  size: 44, align: "right"  },
    promotedByName: { x: 2020, y: 3640, maxW: 900, size: 40, align: "right" },
    promotedByCode: { x: 2020, y: 3750, maxW: 900, size: 40, align: "right" },
    footerDate: { x: 2870, y: 4470, maxW: 700, size: 38, align: "right" },
  },
  card: {
    image: "assets/card_template.jpg",
    name:    { x: 1050, y: 165,  maxW: 780, size: 40, align: "right", color: "#fff" },
    code:    { x: 950,  y: 315,  maxW: 880, size: 40, align: "right", color: "#fff" },
    phone:   { x: 950,  y: 515,  maxW: 880, size: 40, align: "right", color: "#fff" },
    joined:  { x: 880,  y: 715,  maxW: 800, size: 40, align: "right", color: "#fff" },
  }
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// shrinks font-size until `text` fits inside maxWidth, then draws it
function drawFitText(ctx, text, spec) {
  let size = spec.size;
  ctx.textBaseline = "middle";
  do {
    ctx.font = `bold ${size}px ${FONT_FAMILY}`;
    if (ctx.measureText(text).width <= spec.maxW || size <= 16) break;
    size -= 2;
  } while (true);
  ctx.fillStyle = spec.color || "#111";
  ctx.textAlign = spec.align || "right";
  ctx.fillText(text, spec.x, spec.y, spec.maxW);
}

function fmtDateArabic(d) {
  const dt = (d instanceof Date) ? d : new Date(d);
  const months = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  return `${dt.getDate()}/ ${months[dt.getMonth()]} /${dt.getFullYear()}`;
}

async function generateRegistrationCertificate(member) {
  const c = COORDS.register;
  const img = await loadImage(c.image);
  const canvas = document.createElement("canvas");
  canvas.width = img.width; canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  drawFitText(ctx, member.name, c.name);
  drawFitText(ctx, rankLabel(member.rank_code), c.rank);
  drawFitText(ctx, fmtDateArabic(member.registered_at), c.date);
  drawFitText(ctx, member.membership_code, c.code);
  const durationText = member.membership_expires_at ? "سنة قابلة للتجديد" :
    (member.rank_code === "SA" ? "سنتين قابلة للتجديد" : "دائمة");
  drawFitText(ctx, durationText, c.duration);
  drawFitText(ctx, member.registered_by_name || "", c.registeredByName);
  drawFitText(ctx, member.registered_by_code || "", c.registeredByCode);
  drawFitText(ctx, fmtDateArabic(new Date()), c.footerDate);

  return canvas.toDataURL("image/jpeg", 0.95);
}

async function generateRankChangeCertificate(member, adminName, adminCode, dateOfChange) {
  const c = COORDS.rankChange;
  const img = await loadImage(c.image);
  const canvas = document.createElement("canvas");
  canvas.width = img.width; canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  drawFitText(ctx, member.name, c.name);
  drawFitText(ctx, rankLabel(member.rank_code), c.newRank);
  drawFitText(ctx, fmtDateArabic(dateOfChange || new Date()), c.date);
  drawFitText(ctx, member.membership_code, c.code);
  drawFitText(ctx, adminName || "", c.promotedByName);
  drawFitText(ctx, adminCode || "", c.promotedByCode);
  drawFitText(ctx, fmtDateArabic(new Date()), c.footerDate);

  return canvas.toDataURL("image/jpeg", 0.95);
}

async function generateCard(member) {
  const c = COORDS.card;
  const img = await loadImage(c.image);
  const canvas = document.createElement("canvas");
  canvas.width = img.width; canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  drawFitText(ctx, member.name, c.name);
  drawFitText(ctx, member.membership_code, c.code);
  drawFitText(ctx, member.phone, c.phone);
  drawFitText(ctx, fmtDateArabic(member.registered_at), c.joined);

  return canvas.toDataURL("image/jpeg", 0.95);
}

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
