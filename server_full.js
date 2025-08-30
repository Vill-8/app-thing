
// server_full.js
// Simple full-featured backend with file persistence for your MVP.
// Run: npm init -y && npm install express cors nanoid && node server_full.js

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { nanoid } = require("nanoid");

const app = express();
const PORT = 5500;

app.use(cors());
app.use(express.json());

const DATA_FILE = path.join(__dirname, "data.json");

// --- Persistence ---
function loadDB() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    return {
      users: {},             // userId -> { name, status, availability:{} }
      circles: [],           // [{ id, name, members:[userId], status, info }]
      chats: {},             // circleId -> [{ id, authorId, authorName, message, ts }]
      meetups: []            // [{ id, title, details, time, total, attendees:[userId] }]
    };
  }
}
let db = loadDB();

let savePending = null;
function saveDB() {
  if (savePending) return;
  savePending = setTimeout(() => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
    savePending = null;
  }, 150);
}

// --- Seed data on first run ---
if (db.circles.length === 0) {
  const studyId = nanoid(8);
  const roomId = nanoid(8);
  const photoId = nanoid(8);
  const gymId = nanoid(8);
  db.circles = [
    { id: studyId, name: "📚 Study Buddies", members: [], status: "online", info: "3 available now" },
    { id: roomId,  name: "🏠 Roommate Squad", members: [], status: "busy", info: "Mixed availability" },
    { id: photoId, name: "📸 Photography Club", members: [], status: "away", info: "Planning weekend shoot" },
    { id: gymId,   name: "💪 Gym Partners", members: [], status: "online", info: "Ready for 6 PM session" },
  ];
  db.chats[studyId] = [
    { id: nanoid(6), authorId: "sys", authorName: "System", message: "Welcome to Study Buddies!", ts: Date.now() }
  ];
  db.chats[roomId]  = [{ id: nanoid(6), authorId: "sys", authorName: "System", message: "Welcome to Roommate Squad!", ts: Date.now() }];
  db.chats[photoId] = [{ id: nanoid(6), authorId: "sys", authorName: "System", message: "Welcome to Photography Club!", ts: Date.now() }];
  db.chats[gymId]   = [{ id: nanoid(6), authorId: "sys", authorName: "System", message: "Welcome to Gym Partners!", ts: Date.now() }];
  db.meetups = [
    { id: nanoid(8), title: "Study Session",    details: "📚 Library Group Study", time: "Today, 7:00 PM", total: 6, attendees: [] },
    { id: nanoid(8), title: "Coffee Break",     details: "☕ Campus Café Meetup",  time: "Tomorrow, 2:00 PM", total: 8, attendees: [] },
    { id: nanoid(8), title: "Movie Night",      details: "🎬 Dorm Common Room",    time: "Friday, 8:00 PM", total: 12, attendees: [] },
    { id: nanoid(8), title: "Workout Session",  details: "💪 Campus Gym",          time: "Saturday, 10:00 AM", total: 4, attendees: [] },
  ];
  saveDB();
}

// --- Helpers ---
function getOrCreateUser(userId, name = "User") {
  if (!userId) return null;
  if (!db.users[userId]) {
    db.users[userId] = { name, status: "free", availability: {} };
    saveDB();
  }
  return db.users[userId];
}

function findCircleById(id) {
  return db.circles.find(c => c.id === id);
}

// --- Users ---
app.post("/api/users", (req, res) => {
  const { userId, name } = req.body;
  if (!userId) return res.status(400).json({ error: "userId required" });
  const u = getOrCreateUser(userId, name || "User");
  res.json({ userId, ...u });
});

// --- Circles ---
app.get("/api/circles", (req, res) => {
  res.json(db.circles);
});

app.post("/api/circles", (req, res) => {
  const { name, status = "online", info = "New circle", userId } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  const id = nanoid(8);
  const circle = { id, name, members: [], status, info };
  if (userId) {
    getOrCreateUser(userId);
    circle.members.push(userId);
  }
  db.circles.push(circle);
  db.chats[id] = [{ id: nanoid(6), authorId: "sys", authorName: "System", message: `Welcome to ${name}!`, ts: Date.now() }];
  saveDB();
  res.json(circle);
});

// --- Membership ---
app.post("/api/circles/:id/join", (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  const circle = findCircleById(id);
  if (!circle) return res.status(404).json({ error: "circle not found" });
  if (userId) {
    getOrCreateUser(userId);
    if (!circle.members.includes(userId)) circle.members.push(userId);
    saveDB();
  }
  res.json(circle);
});

// --- Chats ---
app.get("/api/chat/:circleId", (req, res) => {
  const { circleId } = req.params;
  const messages = db.chats[circleId] || [];
  res.json(messages);
});

app.post("/api/chat/:circleId", (req, res) => {
  const { circleId } = req.params;
  const { authorId, authorName, message } = req.body;
  if (!message) return res.status(400).json({ error: "message required" });
  const msg = { id: nanoid(6), authorId: authorId || "anon", authorName: authorName || "Anon", message, ts: Date.now() };
  if (!db.chats[circleId]) db.chats[circleId] = [];
  db.chats[circleId].push(msg);
  saveDB();
  res.json(msg);
});

// --- Status ---
app.get("/api/status/:userId", (req, res) => {
  const { userId } = req.params;
  const u = getOrCreateUser(userId);
  res.json({ userId, status: u.status });
});

app.post("/api/status/:userId", (req, res) => {
  const { userId } = req.params;
  const { status } = req.body;
  const u = getOrCreateUser(userId);
  if (status) u.status = status;
  saveDB();
  res.json({ userId, status: u.status });
});

// --- Availability ---
app.get("/api/availability/:userId", (req, res) => {
  const { userId } = req.params;
  const u = getOrCreateUser(userId);
  res.json({ userId, availability: u.availability });
});

app.post("/api/availability/:userId", (req, res) => {
  const { userId } = req.params;
  const { day, state } = req.body; // state: 'available' | 'busy' | 'unselect'
  const u = getOrCreateUser(userId);
  if (day == null || !state) return res.status(400).json({ error: "day and state required" });
  u.availability[day] = state;
  saveDB();
  res.json({ userId, availability: u.availability });
});

// --- Meetups ---
app.get("/api/meetups", (req, res) => {
  const out = db.meetups.map(m => ({ 
    id: m.id, title: m.title, details: m.details, time: m.time, total: m.total, people: m.attendees.length 
  }));
  res.json(out);
});

app.post("/api/meetups", (req, res) => {
  const { title, details, time, total = 6 } = req.body;
  if (!title) return res.status(400).json({ error: "title required" });
  const meetup = { id: nanoid(8), title, details: details || "", time: time || "", total, attendees: [] };
  db.meetups.push(meetup);
  saveDB();
  res.json(meetup);
});

app.post("/api/meetups/:id/join", (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  const m = db.meetups.find(x => x.id === id);
  if (!m) return res.status(404).json({ error: "meetup not found" });
  if (!m.attendees.includes(userId)) {
    if (m.attendees.length < m.total) m.attendees.push(userId);
  }
  saveDB();
  res.json({ id: m.id, title: m.title, details: m.details, time: m.time, total: m.total, people: m.attendees.length });
});

app.listen(PORT, () => {
  console.log(`✅ Backend running at http://localhost:${PORT}`);
});
