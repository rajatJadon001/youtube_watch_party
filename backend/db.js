const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:rajput@localhost:5432/watch_party",
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rooms (
      room_id VARCHAR(6) PRIMARY KEY,
      video_id TEXT NOT NULL DEFAULT '',
      play_state VARCHAR(10) NOT NULL DEFAULT 'paused',
      current_time_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
      last_update_timestamp BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS participants (
      client_token UUID NOT NULL,
      room_id VARCHAR(6) NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
      username TEXT NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'participant',
      socket_id TEXT,
      is_connected BOOLEAN NOT NULL DEFAULT TRUE,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (client_token, room_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      room_id VARCHAR(6) NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
      username TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function roomExists(roomId) {
  const result = await pool.query("SELECT room_id FROM rooms WHERE room_id = $1", [roomId]);
  return result.rowCount > 0;
}

async function createRoom(roomId) {
  await pool.query(
    "INSERT INTO rooms (room_id, video_id, play_state, current_time_seconds, last_update_timestamp) VALUES ($1, '', 'paused', 0, $2)",
    [roomId, Date.now()]
  );
}

async function getRoom(roomId) {
  const result = await pool.query("SELECT * FROM rooms WHERE room_id = $1", [roomId]);
  return result.rows[0] || null;
}

async function updateRoomState(roomId, { videoId, playState, currentTime }) {
  await pool.query(
    `UPDATE rooms
     SET video_id = COALESCE($2, video_id),
         play_state = COALESCE($3, play_state),
         current_time_seconds = COALESCE($4, current_time_seconds),
         last_update_timestamp = $5
     WHERE room_id = $1`,
    [roomId, videoId ?? null, playState ?? null, currentTime ?? null, Date.now()]
  );
}

async function deleteRoom(roomId) {
  await pool.query("DELETE FROM rooms WHERE room_id = $1", [roomId]);
}

function getLiveCurrentTime(room) {
  if (room.play_state !== "playing") {
    return Number(room.current_time_seconds);
  }
  const secondsElapsed = (Date.now() - Number(room.last_update_timestamp)) / 1000;
  return Number(room.current_time_seconds) + secondsElapsed;
}

async function upsertParticipant(clientToken, roomId, username, role, socketId) {
  await pool.query(
    `INSERT INTO participants (client_token, room_id, username, role, socket_id, is_connected)
     VALUES ($1, $2, $3, $4, $5, TRUE)
     ON CONFLICT (client_token, room_id)
     DO UPDATE SET socket_id = $5, is_connected = TRUE, username = $3`,
    [clientToken, roomId, username, role, socketId]
  );
}

async function findParticipant(clientToken, roomId) {
  const result = await pool.query(
    "SELECT * FROM participants WHERE client_token = $1 AND room_id = $2",
    [clientToken, roomId]
  );
  return result.rows[0] || null;
}

async function findParticipantBySocketId(socketId) {
  const result = await pool.query(
    "SELECT * FROM participants WHERE socket_id = $1",
    [socketId]
  );
  return result.rows[0] || null;
}

async function getParticipants(roomId) {
  const result = await pool.query(
    "SELECT client_token, username, role, is_connected FROM participants WHERE room_id = $1 ORDER BY joined_at ASC",
    [roomId]
  );
  return result.rows.map((row) => ({
    userId: row.client_token,
    username: row.username,
    role: row.role,
    isConnected: row.is_connected,
  }));
}

async function updateParticipantRole(clientToken, roomId, role) {
  await pool.query(
    "UPDATE participants SET role = $3 WHERE client_token = $1 AND room_id = $2",
    [clientToken, roomId, role]
  );
}

async function setParticipantConnection(clientToken, roomId, isConnected, socketId) {
  await pool.query(
    "UPDATE participants SET is_connected = $3, socket_id = $4 WHERE client_token = $1 AND room_id = $2",
    [clientToken, roomId, isConnected, socketId]
  );
}

async function removeParticipant(clientToken, roomId) {
  await pool.query(
    "DELETE FROM participants WHERE client_token = $1 AND room_id = $2",
    [clientToken, roomId]
  );
}

async function countParticipants(roomId) {
  const result = await pool.query(
    "SELECT COUNT(*)::int AS count FROM participants WHERE room_id = $1",
    [roomId]
  );
  return result.rows[0].count;
}

async function getFirstRemainingParticipant(roomId) {
  const result = await pool.query(
    "SELECT * FROM participants WHERE room_id = $1 ORDER BY is_connected DESC, joined_at ASC LIMIT 1",
    [roomId]
  );
  return result.rows[0] || null;
}

async function addChatMessage(roomId, username, message) {
  await pool.query(
    "INSERT INTO chat_messages (room_id, username, message) VALUES ($1, $2, $3)",
    [roomId, username, message]
  );
}

async function getRecentChatMessages(roomId, limit = 50) {
  const result = await pool.query(
    "SELECT username, message, created_at FROM chat_messages WHERE room_id = $1 ORDER BY created_at ASC LIMIT $2",
    [roomId, limit]
  );
  return result.rows.map((row) => ({
    username: row.username,
    message: row.message,
    time: new Date(row.created_at).toLocaleTimeString(),
  }));
}

module.exports = {
  pool,
  initDb,
  roomExists,
  createRoom,
  getRoom,
  updateRoomState,
  deleteRoom,
  getLiveCurrentTime,
  upsertParticipant,
  findParticipant,
  findParticipantBySocketId,
  getParticipants,
  updateParticipantRole,
  setParticipantConnection,
  removeParticipant,
  countParticipants,
  getFirstRemainingParticipant,
  addChatMessage,
  getRecentChatMessages,
};
