const crypto = require("crypto");

// "Komanda görmə" qaydası:
// Komissarlar bir-birini, mafialar bir-birini görür.
// Manyak, Doktor, Bomj, Məşuqə və Vətəndaş heç kimi görmür.
const TEAM_VISIBILITY_ROLES = ["komissar", "mafia"];

function generateGameId() {
  return crypto.randomInt(1000, 10000).toString();
}
function formatAzDateTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat("az-AZ", {
    timeZone: "Asia/Baku",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const getPart = (type) =>
    parts.find((part) => part.type === type)?.value || "";

  const day = getPart("day");
  const month = getPart("month");
  const year = getPart("year");
  const hour = getPart("hour");
  const minute = getPart("minute");

  return `${day} ${month} ${year}, ${hour}:${minute}`;
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

function buildEmailHtml(assignment, allAssignments, gameId) {
  const roleLower = assignment.role.toLowerCase();
  const inTeamGroup = TEAM_VISIBILITY_ROLES.includes(roleLower);
  const timestamp = formatAzDateTime();

  let teammatesHtml = "";

  if (inTeamGroup) {
    const teammates = allAssignments.filter(
      (a) =>
        a.email !== assignment.email &&
        a.role.toLowerCase() === roleLower
    );

    if (teammates.length > 0) {
      const label =
        roleLower === "mafia"
          ? "Sənin komandan"
          : "Digər komissarlar";

      teammatesHtml = `
        <div style="
          margin-top:22px;
          padding:18px 20px;
          background:#fdf6f4;
          border:1px solid #f1ddd7;
          border-radius:14px;
        ">
          <p style="
            margin:0 0 10px;
            font-size:11px;
            letter-spacing:0.12em;
            text-transform:uppercase;
            color:#c0392b;
            font-weight:700;
          ">
            ${label}
          </p>

          ${teammates
            .map(
              (teammate) => `
                <p style="
                  margin:4px 0;
                  font-size:15px;
                  color:#262420;
                ">
                  <span style="font-weight:600;">
                    ${teammate.name}
                  </span>
                </p>
              `
            )
            .join("")}
        </div>
      `;
    } else {
      teammatesHtml = `
        <div style="
          margin-top:22px;
          padding:18px 20px;
          background:#fdf6f4;
          border:1px solid #f1ddd7;
          border-radius:14px;
        ">
          <p style="
            margin:0;
            font-size:14px;
            color:#262420;
          ">
            Bu oyunda tək başınasan, komandanda başqa kimsə yoxdur.
          </p>
        </div>
      `;
    }
  }

  return `
    <div style="
      background:#f2f0eb;
      padding:44px 16px;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
    ">
      <div style="
        max-width:480px;
        margin:0 auto;
        background:#ffffff;
        border:1px solid #e8e4db;
        border-radius:20px;
        overflow:hidden;
        box-shadow:0 8px 32px rgba(38,36,32,0.06);
      ">

        <div style="
          background:linear-gradient(135deg,#ffffff,#faf7f1);
          padding:24px 28px;
          border-bottom:1px solid #eee9df;
          text-align:center;
        ">
          <p style="
            margin:0;
            font-size:11px;
            letter-spacing:0.16em;
            text-transform:uppercase;
            color:#c0392b;
            font-weight:700;
          ">
            Mafia Oyunu
          </p>
        </div>

        <div style="padding:12px 28px 0;">
          <p style="
            margin:22px 0 0;
            font-size:15px;
            color:#6b665c;
          ">
            Salam, ${assignment.name}
          </p>
        </div>

        <div style="
          padding:26px 28px 6px;
          text-align:center;
        ">
          <div style="
            font-size:60px;
            line-height:1;
          ">
            ${roleLogo(assignment.role)}
          </div>

          <p style="
            margin:18px 0 2px;
            font-size:11px;
            letter-spacing:0.14em;
            text-transform:uppercase;
            color:#9a9488;
          ">
            Sənin rolun
          </p>

          <p style="
            margin:2px 0 0;
            font-size:28px;
            font-weight:800;
            color:#c0392b;
            letter-spacing:0.01em;
          ">
            ${assignment.role.toUpperCase()}
          </p>
        </div>

        <div style="padding:6px 28px 34px;">
          ${teammatesHtml}

          <div style="
            margin-top:26px;
            padding-top:20px;
            border-top:1px solid #eee9df;
            text-align:center;
          ">
            <p style="
              margin:0;
              font-size:13px;
              color:#9a9488;
            ">
              Uğurlar, oyun başlasın!
            </p>

            <div style="
              margin-top:14px;
              padding:12px;
              border-radius:10px;
            ">
              <p style="
                margin:0;
                font-size:10px;
                text-transform:uppercase;
                color:#9a9488;
              ">
                Oyun ID
              </p>

              <p style="
                margin:5px 0 0;
                font-size:15px;
                font-weight:700;
                letter-spacing:0.08em;
                color:#c0392b;
                font-family:'SF Mono',Consolas,monospace;
              ">
                ${gameId}
              </p>
            </div>

            <p style="
              margin:12px 0 0;
              font-size:11px;
              color:#9a9488;
              font-family:'SF Mono',Consolas,monospace;
            ">
              ${timestamp}
            </p>
          </div>
        </div>

      </div>
    </div>
  `;
}

module.exports = {
  shuffle,
  buildEmailHtml,
  roleLogo,
  generateGameId,
};