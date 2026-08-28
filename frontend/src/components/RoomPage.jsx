import { useState } from "react";
import { socket } from "../socket.js";
import YouTubePlayer from "./YouTubePlayer.jsx";
import ParticipantList from "./ParticipantList.jsx";
import ChatBox from "./ChatBox.jsx";

function RoomPage(props) {
  const {
    roomId,
    myRole,
    videoId,
    playState,
    currentTime,
    participants,
    chatMessages,
    errorMsg,
    onLeaveRoom,
  } = props;

  const [videoInput, setVideoInput] = useState("");

  const canControl = myRole === "host";

  function extractVideoId(input) {

    const match = input.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
    );
    if (match) {
      return match[1];
    }
    return input.trim();
  }

  function handlePlay() {
    const liveTime = YouTubePlayer.getLiveTime ? YouTubePlayer.getLiveTime() : currentTime;
    socket.emit("play", { currentTime: liveTime });
  }

  function handlePause() {
    const liveTime = YouTubePlayer.getLiveTime ? YouTubePlayer.getLiveTime() : currentTime;
    socket.emit("pause", { currentTime: liveTime });
  }

  function handleSeekForward() {
    const liveTime = YouTubePlayer.getLiveTime ? YouTubePlayer.getLiveTime() : currentTime;
    socket.emit("seek", { time: liveTime + 10 });
  }

  function handleSeekBackward() {
    const liveTime = YouTubePlayer.getLiveTime ? YouTubePlayer.getLiveTime() : currentTime;
    socket.emit("seek", { time: Math.max(0, liveTime - 10) });
  }

  function handleChangeVideo() {
    if (videoInput.trim() === "") return;
    const newVideoId = extractVideoId(videoInput.trim());
    socket.emit("change_video", { videoId: newVideoId });
    setVideoInput("");
  }

  function copyRoomCode() {
    navigator.clipboard.writeText(roomId);
    alert("Room code copied: " + roomId);
  }

  return (
    <div className="container">
      <div className="room-header">
        <h2>🎬 Watch Party</h2>
        <div>
          <span className="room-code-badge" onClick={copyRoomCode} title="Click to copy">
            Room Code: {roomId}
          </span>
          <button onClick={onLeaveRoom} style={{ marginLeft: "10px" }}>
            Leave Room
          </button>
        </div>
      </div>

      {errorMsg && <p className="error-text">{errorMsg}</p>}

      <div className="room-layout">
        <div className="player-column">
          <div className="video-wrapper">
            {videoId ? (
              <YouTubePlayer
                videoId={videoId}
                playState={playState}
                currentTime={currentTime}
                containerId="yt-player"
              />
            ) : (

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#888",
                }}
              >
                {canControl ? "Paste a YouTube link below to start" : "Waiting for host to start a video..."}
              </div>
            )}
          </div>

          <div className="controls">
            <button onClick={handleSeekBackward} disabled={!canControl}>
              ⏮ Prev
            </button>
            <button onClick={handlePlay} disabled={!canControl}>
              ▶ Play
            </button>
            <button onClick={handlePause} disabled={!canControl}>
              ⏸ Pause
            </button>
            <button onClick={handleSeekForward} disabled={!canControl}>
              ⏭ Forward
            </button>
          </div>

          <div className="controls">
            <input
              type="text"
              placeholder={canControl ? "Paste YouTube URL or video ID" : "Only host can load a video"}
              value={videoInput}
              onChange={(e) => setVideoInput(e.target.value)}
              disabled={!canControl}
            />
            <button onClick={handleChangeVideo} disabled={!canControl}>
              Load Video
            </button>
          </div>

          {!canControl && (
            <p style={{ color: "#888", fontSize: "13px" }}>
              You are watching only. The Host controls everything here — loading the video,
              Play, Pause, Prev, and Forward. If you just joined, the video is paused at the
              correct spot — it will start playing with everyone the next time the Host presses Play.
            </p>
          )}
        </div>

        <div className="side-column">
          <ParticipantList participants={participants} myRole={myRole} />
          <ChatBox messages={chatMessages} />
        </div>
      </div>
    </div>
  );
}

export default RoomPage;
