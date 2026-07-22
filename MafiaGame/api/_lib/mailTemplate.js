// Paylaşılan məntiq: rol loqoları + HTML mail şablonu

// "Komanda görmə" qaydası: bu siyahıdakı rollardan olan hər kəs
// eyni rola sahib digərlərini görür (Komissarlar bir-birini, Mafialar bir-birini).
// Manyak, Doktor, Bomj, Məşuqə, Vətəndaş bu qrupa daxil deyil — heç kimi görmür.
const TEAM_VISIBILITY_ROLES = ["komissar", "mafia"];

const AZ_MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun",
  "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr",
];

function formatAzDateTime(date) {
  const d = date || new Date();
  const day = d.getDate();
  const month = AZ_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year}, ${hh}:${mm}`;
}

function roleLogo(role) {
  const ROLE_LOGOS = {
    komissar: "🎖️",
    mafia: "🎩",
    doktor: "💉",
    məşuqə: "🌙",
    bomj: "🥃",
    manyak: "🔪",
    vətəndaş: "👤",
  };
  return ROLE_LOGOS[role.toLowerCase()] || "🎭";
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildEmailHtml(assignment, allAssignments) {
  const roleLower = assignment.role.toLowerCase();
  const inTeamGroup = TEAM_VISIBILITY_ROLES.includes(roleLower);
  const timestamp = formatAzDateTime(new Date());

  let teammatesHtml = "";
  if (inTeamGroup) {
    const teammates = allAssignments.filter(
      (a) => a.email !== assignment.email && a.role.toLowerCase() === roleLower
    );
    if (teammates.length > 0) {
      const label = roleLower === "mafia" ? "Sənin komandan" : "Digər komissarlar";
      teammatesHtml = `
        <div style="margin-top:22px; padding:18px 20px; background:#fdf6f4; border:1px solid #f1ddd7; border-radius:14px;">
          <p style="margin:0 0 10px; font-size:11px; letter-spacing:0.12em; text-transform:uppercase; color:#c0392b; font-weight:700;">${label}</p>
          ${teammates
            .map(
              (t) =>
                `<p style="margin:4px 0; font-size:15px; color:#262420; display:flex; align-items:center; gap:8px;">${roleLogo(t.role)} <span style="font-weight:600;">${t.name}</span></p>`
            )
            .join("")}
        </div>`;
    } else {
      teammatesHtml = `
        <div style="margin-top:22px; padding:18px 20px; background:#fdf6f4; border:1px solid #f1ddd7; border-radius:14px;">
          <p style="margin:0; font-size:14px; color:#262420;">Bu oyunda tək başınasan, komandanda başqa kimsə yoxdur.</p>
        </div>`;
    }
  }

  return `
  <div style="background:#f2f0eb; padding:44px 16px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <div style="max-width:480px; margin:0 auto; background:#ffffff; border:1px solid #e8e4db; border-radius:20px; overflow:hidden; box-shadow:0 8px 32px rgba(38,36,32,0.06);">

      <div style="background:linear-gradient(135deg,#ffffff,#faf7f1); padding:24px 28px; border-bottom:1px solid #eee9df; display:flex; align-items:center; justify-content:space-between;">
        <p style="margin:0; font-size:11px; letter-spacing:0.16em; text-transform:uppercase; color:#c0392b; font-weight:700;">Mafia Oyunu</p>
        <p style="margin:0; font-size:11px; color:#9a9488; font-family:'SF Mono',Consolas,monospace;">${timestamp}</p>
      </div>

      <div style="padding:12px 28px 0;">
        <p style="margin:22px 0 0; font-size:15px; color:#6b665c;">Salam, ${assignment.name}</p>
      </div>

      <div style="padding:26px 28px 6px; text-align:center;">
        <div style="width:96px; height:96px; margin:0 auto; display:flex; align-items:center; justify-content:center; font-size:44px;">
          ${roleLogo(assignment.role)}
        </div>
        <p style="margin:18px 0 2px; font-size:11px; letter-spacing:0.14em; text-transform:uppercase; color:#9a9488;">Sənin rolun</p>
        <p style="margin:2px 0 0; font-size:28px; font-weight:800; color:#c0392b; letter-spacing:0.01em;">${assignment.role.toUpperCase()}</p>
      </div>

      <div style="padding:6px 28px 34px;">
        ${teammatesHtml}
        <div style="margin-top:26px; padding-top:20px; border-top:1px solid #eee9df; text-align:center;">
          <p style="margin:0; font-size:13px; color:#9a9488;">Uğurlar, oyun başlasın 🎲</p>
        </div>
      </div>

    </div>
  </div>`;
}

module.exports = { shuffle, buildEmailHtml, roleLogo };