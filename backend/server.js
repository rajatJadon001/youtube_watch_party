const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const db = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Watch Party backend is running!");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

function canControlPlayback(role) {
  return role === "host";
}

function generateRoomId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    code += chars[randomIndex];
  }
  return code;
}

async function generateUniqueRoomId() {
  let roomId = generateRoomId();
  while (await db.roomExists(roomId)) {
    roomId = generateRoomId();
  }
  return roomId;
}

io.on("connection", (socket) => {
  socket.data.roomId = null;
  socket.data.clientToken = null;

  socket.on("create_room", async ({ username, clientToken }) => {
    try {
      const roomId = await generateUniqueRoomId();
      await db.createRoom(roomId);
      await db.upsertParticipant(clientToken, roomId, username || "Host", "host", socket.id);

      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.clientToken = clientToken;

      const room = await db.getRoom(roomId);
      const participants = await db.getParticipants(roomId);

      socket.emit("room_created", {
        roomId: roomId,
        videoId: room.video_id,
        playState: "paused",
        currentTime: 0,
        participants: participants,
        chatHistory: [],
        yourRole: "host",
      });
    } catch (err) {
      console.error("create_room failed:", err.message);
      socket.emit("error_message", { message: "Could not create room. Please try again." });
    }
  });

  socket.on("join_room", async ({ roomId, username, clientToken }) => {
    try {
      const room = await db.getRoom(roomId);
      if (!room) {
        socket.emit("error_message", { message: "Room not found. Check the room code." });
        return;
      }

      const existingParticipant = await db.findParticipant(clientToken, roomId);
      const roleToUse = existingParticipant ? existingParticipant.role : "participant";

      await db.upsertParticipant(clientToken, roomId, username || "Guest", roleToUse, socket.id);

      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.clientToken = clientToken;

      const participants = await db.getParticipants(roomId);
      const chatHistory = await db.getRecentChatMessages(roomId);
      const liveCurrentTime = db.getLiveCurrentTime(room);

      socket.emit("room_joined", {
        roomId: roomId,
        videoId: room.video_id,
        playState: "paused",
        currentTime: liveCurrentTime,
        participants: participants,
        chatHistory: chatHistory,
        yourRole: roleToUse,
      });

      io.to(roomId).emit("user_joined", {
        username: username,
        userId: clientToken,
        role: roleToUse,
        participants: participants,
      });
    } catch (err) {
      console.error("join_room failed:", err.message);
      socket.emit("error_message", { message: "Could not join room. Please try again." });
    }
  });

  socket.on("play", async ({ currentTime }) => {
    try {
      const roomId = socket.data.roomId;
      const clientToken = socket.data.clientToken;
      if (!roomId || !clientToken) return;

      const participant = await db.findParticipant(clientToken, roomId);
      if (!participant || !canControlPlayback(participant.role)) {
        socket.emit("error_message", { message: "Only the host can control playback." });
        return;
      }

      await db.updateRoomState(roomId, {
        playState: "playing",
        currentTime: typeof currentTime === "number" ? currentTime : undefined,
      });

      const room = await db.getRoom(roomId);
      io.to(roomId).emit("sync_state", {
        playState: room.play_state,
        currentTime: Number(room.current_time_seconds),
        videoId: room.video_id,
      });
    } catch (err) {
      console.error("play failed:", err.message);
    }
  });

  socket.on("pause", async ({ currentTime }) => {
    try {
      const roomId = socket.data.roomId;
      const clientToken = socket.data.clientToken;
      if (!roomId || !clientToken) return;

      const participant = await db.findParticipant(clientToken, roomId);
      if (!participant || !canControlPlayback(participant.role)) {
        socket.emit("error_message", { message: "Only the host can control playback." });
        return;
      }

      await db.updateRoomState(roomId, {
        playState: "paused",
        currentTime: typeof currentTime === "number" ? currentTime : undefined,
      });

      const room = await db.getRoom(roomId);
      io.to(roomId).emit("sync_state", {
        playState: room.play_state,
        currentTime: Number(room.current_time_seconds),
        videoId: room.video_id,
      });
    } catch (err) {
      console.error("pause failed:", err.message);
    }
  });

  socket.on("seek", async ({ time }) => {
    try {
      const roomId = socket.data.roomId;
      const clientToken = socket.data.clientToken;
      if (!roomId || !clientToken) return;

      const participant = await db.findParticipant(clientToken, roomId);
      if (!participant || !canControlPlayback(participant.role)) {
        socket.emit("error_message", { message: "Only the host can seek." });
        return;
      }

      await db.updateRoomState(roomId, { currentTime: time });

      const room = await db.getRoom(roomId);
      io.to(roomId).emit("sync_state", {
        playState: room.play_state,
        currentTime: Number(room.current_time_seconds),
        videoId: room.video_id,
      });
    } catch (err) {
      console.error("seek failed:", err.message);
    }
  });

  socket.on("change_video", async ({ videoId }) => {
    try {
      const roomId = socket.data.roomId;
      const clientToken = socket.data.clientToken;
      if (!roomId || !clientToken) return;

      const participant = await db.findParticipant(clientToken, roomId);
      if (!participant || !canControlPlayback(participant.role)) {
        socket.emit("error_message", { message: "Only the host can change/load the video link." });
        return;
      }

      await db.updateRoomState(roomId, {
        videoId: videoId,
        playState: "paused",
        currentTime: 0,
      });

      const room = await db.getRoom(roomId);
      io.to(roomId).emit("sync_state", {
        playState: room.play_state,
        currentTime: Number(room.current_time_seconds),
        videoId: room.video_id,
      });
    } catch (err) {
      console.error("change_video failed:", err.message);
    }
  });

  socket.on("assign_role", async ({ userId, role }) => {
    try {
      const roomId = socket.data.roomId;
      const clientToken = socket.data.clientToken;
      if (!roomId || !clientToken) return;

      const me = await db.findParticipant(clientToken, roomId);
      if (!me || me.role !== "host") {
        socket.emit("error_message", { message: "Only the host can assign roles." });
        return;
      }

      if (userId === clientToken) {
        socket.emit("error_message", { message: "Host role cannot be changed this way." });
        return;
      }

      await db.updateParticipantRole(userId, roomId, role);

      const participants = await db.getParticipants(roomId);
      io.to(roomId).emit("role_assigned", {
        userId: userId,
        role: role,
        participants: participants,
      });
    } catch (err) {
      console.error("assign_role failed:", err.message);
    }
  });

  socket.on("remove_participant", async ({ userId }) => {
    try {
      const roomId = socket.data.roomId;
      const clientToken = socket.data.clientToken;
      if (!roomId || !clientToken) return;

      const me = await db.findParticipant(clientToken, roomId);
      if (!me || me.role !== "host") {
        socket.emit("error_message", { message: "Only the host can remove participants." });
        return;
      }

      if (userId === clientToken) {
        socket.emit("error_message", { message: "Host cannot remove themselves." });
        return;
      }

      const target = await db.findParticipant(userId, roomId);
      await db.removeParticipant(userId, roomId);

      if (target && target.socket_id) {
        io.to(target.socket_id).emit("you_were_removed", { roomId: roomId });
        const targetSocket = io.sockets.sockets.get(target.socket_id);
        if (targetSocket) targetSocket.leave(roomId);
      }

      const participants = await db.getParticipants(roomId);
      io.to(roomId).emit("participant_removed", {
        userId: userId,
        participants: participants,
      });
    } catch (err) {
      console.error("remove_participant failed:", err.message);
    }
  });

  socket.on("transfer_host", async ({ userId }) => {
    try {
      const roomId = socket.data.roomId;
      const clientToken = socket.data.clientToken;
      if (!roomId || !clientToken) return;

      const me = await db.findParticipant(clientToken, roomId);
      if (!me || me.role !== "host") {
        socket.emit("error_message", { message: "Only the host can transfer host." });
        return;
      }

      const target = await db.findParticipant(userId, roomId);
      if (!target) {
        socket.emit("error_message", { message: "Target user not found." });
        return;
      }

      await db.updateParticipantRole(userId, roomId, "host");
      await db.updateParticipantRole(clientToken, roomId, "moderator");

      const participants = await db.getParticipants(roomId);
      io.to(roomId).emit("role_assigned", {
        userId: "multiple",
        role: "-",
        participants: participants,
      });
    } catch (err) {
      console.error("transfer_host failed:", err.message);
    }
  });

  socket.on("send_chat_message", async ({ message }) => {
    try {
      const roomId = socket.data.roomId;
      const clientToken = socket.data.clientToken;
      if (!roomId || !clientToken || !message) return;

      const participant = await db.findParticipant(clientToken, roomId);
      if (!participant) return;

      await db.addChatMessage(roomId, participant.username, message);

      io.to(roomId).emit("chat_message", {
        username: participant.username,
        message: message,
        time: new Date().toLocaleTimeString(),
      });
    } catch (err) {
      console.error("send_chat_message failed:", err.message);
    }
  });

  socket.on("leave_room", async () => {
    await handleExplicitLeave(socket);
  });

  socket.on("disconnect", async () => {
    await handleDisconnect(socket);
  });

  async function handleExplicitLeave(socket) {
    try {
      const roomId = socket.data.roomId;
      const clientToken = socket.data.clientToken;
      if (!roomId || !clientToken) return;

      const leavingParticipant = await db.findParticipant(clientToken, roomId);
      await db.removeParticipant(clientToken, roomId);

      const remainingCount = await db.countParticipants(roomId);
      if (remainingCount === 0) {
        await db.deleteRoom(roomId);
        socket.leave(roomId);
        return;
      }

      if (leavingParticipant && leavingParticipant.role === "host") {
        const nextParticipant = await db.getFirstRemainingParticipant(roomId);
        if (nextParticipant) {
          await db.updateParticipantRole(nextParticipant.client_token, roomId, "host");
        }
      }

      const participants = await db.getParticipants(roomId);
      io.to(roomId).emit("user_left", {
        username: leavingParticipant ? leavingParticipant.username : "Someone",
        userId: clientToken,
        participants: participants,
      });

      socket.leave(roomId);
    } catch (err) {
      console.error("handleExplicitLeave failed:", err.message);
    }
  }

  async function handleDisconnect(socket) {
    try {
      const roomId = socket.data.roomId;
      const clientToken = socket.data.clientToken;
      if (!roomId || !clientToken) return;

      await db.setParticipantConnection(clientToken, roomId, false, null);

      const participants = await db.getParticipants(roomId);
      io.to(roomId).emit("presence_update", { participants: participants });
    } catch (err) {
      console.error("handleDisconnect failed:", err.message);
    }
  }
});

const PORT = process.env.PORT || 5000;

db.initDb()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Watch Party backend (PostgreSQL) listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err.message);
    process.exit(1);
  });
