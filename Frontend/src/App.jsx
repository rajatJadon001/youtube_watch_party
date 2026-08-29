import { useState, useEffect } from "react";
import { socket } from "./socket.js";
import { getClientToken } from "./clientToken.js";
import HomePage from "./components/HomePage.jsx";
import RoomPage from "./components/RoomPage.jsx";

function App() {
  const [page, setPage] = useState("home");

  const [roomId, setRoomId] = useState("");
  const [username, setUsername] = useState("");
  const [myRole, setMyRole] = useState("participant");
  const [videoId, setVideoId] = useState("");
  const [playState, setPlayState] = useState("paused");
  const [currentTime, setCurrentTime] = useState(0);
  const [participants, setParticipants] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [chatMessages, setChatMessages] = useState([]);

  const clientToken = getClientToken();

  useEffect(() => {
    function onRoomCreated(data) {
      setRoomId(data.roomId);
      setVideoId(data.videoId);
      setPlayState(data.playState);
      setCurrentTime(data.currentTime);
      setParticipants(data.participants);
      setChatMessages(data.chatHistory || []);
      setMyRole(data.yourRole);
      setPage("room");
    }

    function onRoomJoined(data) {
      setRoomId(data.roomId);
      setVideoId(data.videoId);
      setPlayState(data.playState);
      setCurrentTime(data.currentTime);
      setParticipants(data.participants);
      setChatMessages(data.chatHistory || []);
      setMyRole(data.yourRole);
      setPage("room");
    }

    function onUserJoined(data) {
      setParticipants(data.participants);
    }

    function onUserLeft(data) {
      setParticipants(data.participants);
    }

    function onPresenceUpdate(data) {
      setParticipants(data.participants);
    }

    function onSyncState(data) {
      setPlayState(data.playState);
      setCurrentTime(data.currentTime);
      setVideoId(data.videoId);
    }

    function onRoleAssigned(data) {
      setParticipants(data.participants);

      const me = data.participants.find((p) => p.userId === clientToken);
      if (me) {
        setMyRole(me.role);
      }
    }

    function onParticipantRemoved(data) {
      setParticipants(data.participants);
    }

    function onYouWereRemoved() {
      alert("You have been removed from the room by the host.");
      setPage("home");
      setRoomId("");
    }

    function onErrorMessage(data) {
      setErrorMsg(data.message);
      setTimeout(() => setErrorMsg(""), 3000);
    }

    function onChatMessage(data) {
      setChatMessages((prevMessages) => [...prevMessages, data]);
    }

    socket.on("room_created", onRoomCreated);
    socket.on("room_joined", onRoomJoined);
    socket.on("user_joined", onUserJoined);
    socket.on("user_left", onUserLeft);
    socket.on("presence_update", onPresenceUpdate);
    socket.on("sync_state", onSyncState);
    socket.on("role_assigned", onRoleAssigned);
    socket.on("participant_removed", onParticipantRemoved);
    socket.on("you_were_removed", onYouWereRemoved);
    socket.on("error_message", onErrorMessage);
    socket.on("chat_message", onChatMessage);

    return () => {
      socket.off("room_created", onRoomCreated);
      socket.off("room_joined", onRoomJoined);
      socket.off("user_joined", onUserJoined);
      socket.off("user_left", onUserLeft);
      socket.off("presence_update", onPresenceUpdate);
      socket.off("sync_state", onSyncState);
      socket.off("role_assigned", onRoleAssigned);
      socket.off("participant_removed", onParticipantRemoved);
      socket.off("you_were_removed", onYouWereRemoved);
      socket.off("error_message", onErrorMessage);
      socket.off("chat_message", onChatMessage);
    };
  }, [clientToken]);

  function handleCreateRoom(name) {
    setUsername(name);
    if (!socket.connected) {
      socket.connect();
    }
    socket.emit("create_room", { username: name, clientToken: clientToken });
  }

  function handleJoinRoom(name, code) {
    setUsername(name);
    if (!socket.connected) {
      socket.connect();
    }
    socket.emit("join_room", { roomId: code.toUpperCase(), username: name, clientToken: clientToken });
  }

  function handleLeaveRoom() {
    socket.emit("leave_room");
    socket.disconnect();
    setPage("home");
    setRoomId("");
    setParticipants([]);
    setChatMessages([]);
    setVideoId("");
  }

  if (page === "home") {
    return (
      <HomePage
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        errorMsg={errorMsg}
      />
    );
  }

  return (
    <RoomPage
      roomId={roomId}
      username={username}
      myRole={myRole}
      videoId={videoId}
      playState={playState}
      currentTime={currentTime}
      participants={participants}
      chatMessages={chatMessages}
      errorMsg={errorMsg}
      onLeaveRoom={handleLeaveRoom}
    />
  );
}

export default App;
