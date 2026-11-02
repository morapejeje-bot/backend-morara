// moraweb-auth.js — taruh di folder backend Render lo (sejajar index.js)
const express = require("express");
const { MongoClient } = require("mongodb");
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");

const { MONGO_URI, GOOGLE_CLIENT_ID, JWT_SECRET, ADMIN_KEY } = process.env;
const gClient = new OAuth2Client(GOOGLE_CLIENT_ID);
const mongo = new MongoClient(MONGO_URI);
let users;

async function getUsers() {
  if (!users) {
    await mongo.connect();
    users = mongo.db("moraweb").collection("users");
    await users.createIndex({ googleId: 1 }, { unique: true });
  }
  return users;
}

const router = express.Router();
router.use(express.json());

// Dipanggil index.html setelah user klik tombol Google
router.post("/auth/google", async (req, res) => {
  try {
    const ticket = await gClient.verifyIdToken({
      idToken: req.body.credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const p = ticket.getPayload();
    if (!p.email_verified) return res.status(403).json({ error: "Email Google belum terverifikasi" });

    const now = new Date();
    const col = await getUsers();
    await col.updateOne(
      { googleId: p.sub },
      {
        $set: {
          email: p.email,
          name: p.name,
          picture: p.picture,
          lastLogin: now,
          lastIp: req.ip,
          lastUA: req.get("user-agent"),
        },
        $inc: { loginCount: 1 },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );

    const token = jwt.sign({ sub: p.sub, email: p.email, name: p.name }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { name: p.name, email: p.email, picture: p.picture } });
  } catch (e) {
    console.error("auth/google:", e.message);
    res.status(401).json({ error: "Login Google tidak valid" });
  }
});

// Middleware kalau nanti mau kunci route lain (butuh header Authorization: Bearer <token>)
function requireAuth(req, res, next) {
  try {
    req.user = jwt.verify((req.get("authorization") || "").replace("Bearer ", ""), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Harus login dulu" });
  }
}

// Daftar pengguna, dibuka admin.html pakai ADMIN_KEY
router.get("/admin/users", async (req, res) => {
  if (!ADMIN_KEY || req.get("x-admin-key") !== ADMIN_KEY) {
    return res.status(403).json({ error: "Admin key salah" });
  }
  try {
    const col = await getUsers();
    const list = await col.find({}, { projection: { _id: 0 } }).sort({ lastLogin: -1 }).limit(500).toArray();
    res.json({ total: await col.countDocuments(), users: list });
  } catch (e) {
    res.status(500).json({ error: "Database error" });
  }
});

module.exports = { router, requireAuth };
