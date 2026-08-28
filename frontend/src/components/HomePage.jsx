import { useState } from "react";

function HomePage({ onCreateRoom, onJoinRoom, errorMsg }) {

  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [localError, setLocalError] = useState("");

  function handleCreateClick() {
    if (name.trim() === "") {
      setLocalError("Please enter your name first.");
      return;
    }
    setLocalError("");
    onCreateRoom(name.trim());
  }

  function handleJoinClick() {
    if (name.trim() === "") {
      setLocalError("Please enter your name first.");
      return;
    }
    if (roomCode.trim() === "") {
      setLocalError("Please enter a room code to join.");
      return;
    }
    setLocalError("");
    onJoinRoom(name.trim(), roomCode.trim());
  }

  return (
    <div className="home-box">
      <h1>🎬 YouTube Watch Party</h1>

      <input
        type="text"
        placeholder="Enter your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      {localError && <p className="error-text">{localError}</p>}
      {errorMsg && <p className="error-text">{errorMsg}</p>}

      <button onClick={handleCreateClick}>Create New Room</button>

      <hr style={{ borderColor: "#333", margin: "16px 0" }} />

      <input
        type="text"
        placeholder="Enter room code (e.g. K3F9QZ)"
        value={roomCode}
        onChange={(e) => setRoomCode(e.target.value)}
      />
      <button onClick={handleJoinClick}>Join Room</button>
    </div>
  );
}

export default HomePage;
