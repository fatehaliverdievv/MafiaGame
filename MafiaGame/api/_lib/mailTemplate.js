// Paylaşılan məntiq: rol loqoları + HTML mail şablonu

const MAFIA_ROLE_NAMES = ["mafia", "manyak"];
const SERIF_ROLE_NAME = "serif";
const CAVUS_ROLE_NAME = "cavus";

const ROLE_LOGOS = {
  hekim: "🩺",
  serif: "🎖️",
  cavus: "🛡️",
  manyak: "🔪",
  mafia: "🕶️",
  doktor: "💉",
  mesuge: "🌙",
  vetendas: "👤",
};
const DEFAULT_LOGO = "🎭";

function roleLogo(role) {
  return ROLE_LOGOS[role.toLowerCase()] || DEFAULT_LOGO;
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
  const isMafia = MAFIA_ROLE_NAMES.some(
    (r) => r.toLowerCase() === assignment.role.toLowerCase()
  );

  let teammatesHtml = "";
  if (isMafia) {
    const teammates = allAssignments.filter(
      (a) =>
        a.email !== assignment.email &&
        MAFIA_ROLE_NAMES.some((r) => r.toLowerCase() === a.role.toLowerCase())
    );
    if (teammates.length > 0) {
      teammatesHtml = `
        <div style="margin-top:20px; padding:16px 18px; background:#faf1ef; border:1px solid #e8d3ce; border-radius:10px;">
          <p style="margin:0 0 8px; font-size:13px; letter-spacing:0.04em; text-transform:uppercase; color:#a83232; font-weight:600;">Sənin komandan</p>
          ${teammates
            .map(
              (t) =>
                `<p style="margin:2px 0; font-size:15px; color:#262420;">${roleLogo(t.role)} ${t.name}</p>`
            )
            .join("")}
        </div>`;
    } else {
      teammatesHtml = `
        <div style="margin-top:20px; padding:16px 18px; background:#faf1ef; border:1px solid #e8d3ce; border-radius:10px;">
          <p style="margin:0; font-size:14px; color:#262420;">Komandanda başqa oyunçu yoxdur, təksən.</p>
        </div>`;
    }
  }

  let cavusHtml = "";
  if (assignment.role.toLowerCase() === SERIF_ROLE_NAME.toLowerCase()) {
    const cavus = allAssignments.find(
      (a) => a.role.toLowerCase() === CAVUS_ROLE_NAME.toLowerCase()
    );
    if (cavus) {
      cavusHtml = `
        <div style="margin-top:20px; padding:16px 18px; background:#f0f4f2; border:1px solid #d3e0d9; border-radius:10px;">
          <p style="margin:0 0 8px; font-size:13px; letter-spacing:0.04em; text-transform:uppercase; color:#3f7d5c; font-weight:600;">Sənin çavuşun</p>
          <p style="margin:0; font-size:15px; color:#262420;">${roleLogo(cavus.role)} ${cavus.name}</p>
        </div>`;
    }
  }

  return `
  <div style="background:#f6f5f2; padding:40px 16px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <div style="max-width:480px; margin:0 auto; background:#ffffff; border:1px solid #e4e1da; border-radius:14px; overflow:hidden;">

      <div style="background:#262420; padding:28px 24px; text-align:center;">
        <p style="margin:0; font-size:11px; letter-spacing:0.18em; text-transform:uppercase; color:#c9642f;">Mafia Oyunu</p>
        <p style="margin:6px 0 0; font-size:15px; color:#f6f5f2;">Salam, ${assignment.name}</p>
      </div>

      <div style="padding:32px 28px 8px; text-align:center;">
        <div style="font-size:56px; line-height:1;">${roleLogo(assignment.role)}</div>
        <p style="margin:14px 0 2px; font-size:12px; letter-spacing:0.1em; text-transform:uppercase; color:#8a8478;">Sənin rolun</p>
        <p style="margin:0; font-size:26px; font-weight:700; color:#a83232; font-family:Georgia,serif;">${assignment.role.toUpperCase()}</p>
      </div>

      <div style="padding:8px 28px 32px;">
        ${teammatesHtml}
        ${cavusHtml}
        <p style="margin:28px 0 0; text-align:center; font-size:13px; color:#8a8478;">Uğurlar, oyun başlasın 🎲</p>
      </div>

    </div>
  </div>`;
}

module.exports = { shuffle, buildEmailHtml, roleLogo };
