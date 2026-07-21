const nodemailer = require("nodemailer");
const { kv } = require("@vercel/kv");
const { shuffle, buildEmailHtml } = require("./_lib/mailTemplate");

const SENDER_EMAIL = process.env.SENDER_EMAIL;
const SENDER_PASSWORD = process.env.SENDER_PASSWORD;
const SENDER_NAME = process.env.SENDER_NAME || "Mafia Oyunu";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: SENDER_EMAIL, pass: SENDER_PASSWORD },
});

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Yalnız POST qəbul olunur." });
  }

  try {
    const { roles, players } = req.body;

    if (!Array.isArray(roles) || !Array.isArray(players)) {
      return res.status(400).json({ error: "roles və players massiv olmalıdır." });
    }
    if (roles.length === 0 || players.length === 0) {
      return res.status(400).json({ error: "Ən azı 1 rol və 1 iştirakçı lazımdır." });
    }
    if (roles.length !== players.length) {
      return res.status(400).json({
        error: `Rol sayı (${roles.length}) iştirakçı sayına (${players.length}) bərabər deyil.`,
      });
    }

    const shuffledRoles = shuffle(roles);
    const assignments = players.map((player, i) => ({
      name: player.name,
      email: player.email,
      role: shuffledRoles[i],
    }));

    const results = [];
    for (const assignment of assignments) {
      try {
        await transporter.sendMail({
          from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
          to: assignment.email,
          subject: "Mafia Oyunu - Sənin Rolun",
          html: buildEmailHtml(assignment, assignments),
        });
        results.push({ name: assignment.name, email: assignment.email, status: "göndərildi" });
      } catch (err) {
        results.push({ name: assignment.name, email: assignment.email, status: "xəta: " + err.message });
      }
    }

    // Admin görüntüsü üçün Vercel KV-də saxla (serverless funksiyalar öz yaddaşını saxlamır)
    await kv.set("mafia:lastAssignments", assignments);

    res.status(200).json({ ok: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
