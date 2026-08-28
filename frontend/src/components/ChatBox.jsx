import { useState } from "react";
import { socket } from "../socket.js";

function ChatBox({ messages }) {
  const [text, setText] = useState("");

  function sendMessage() {
    if (text.trim() === "") return;
    socket.emit("send_chat_message", { message: text.trim() });
    setText("");
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      sendMessage();
    }
  }

  return (
    <div className="panel">
      <h3>Chat</h3>

      <div className="chat-box">
        {messages.map((m, index) => (

          <div className="chat-message" key={index}>
            <span className="chat-username">{m.username}: </span>
            <span>{m.message}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "6px" }}>
        <input
          type="text"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ flex: 1, padding: "6px", borderRadius: "4px", border: "1px solid #333" }}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}

export default ChatBox;
