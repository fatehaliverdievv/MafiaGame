const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Yalnız POST qəbul olunur." });
  }

  const { password } = req.body;

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Şifrə yalnışdır." });
  }

  let assignments = [];
  try {
    const { kv } = require("@vercel/kv");
    assignments = (await kv.get("mafia:lastAssignments")) || [];
  } catch (kvErr) {
    return res.status(200).json({
      ok: true,
      assignments: [],
      message: "Vercel KV qoşulmayıb, ona görə keçmiş bölgülər saxlanılmır. Storage tabından KV yaradıb layihəyə bağla.",
    });
  }

  if (assignments.length === 0) {
    return res.status(200).json({ ok: true, assignments: [], message: "Hələ heç bir bölgü göndərilməyib." });
  }

  res.status(200).json({ ok: true, assignments });
};