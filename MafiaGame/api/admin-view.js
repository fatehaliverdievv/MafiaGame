const { kv } = require("@vercel/kv");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Yalnız POST qəbul olunur." });
  }

  const { password } = req.body;

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Şifrə yalnışdır." });
  }

  const assignments = (await kv.get("mafia:lastAssignments")) || [];

  if (assignments.length === 0) {
    return res.status(200).json({ ok: true, assignments: [], message: "Hələ heç bir bölgü göndərilməyib." });
  }

  res.status(200).json({ ok: true, assignments });
};
