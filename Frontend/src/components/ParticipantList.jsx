import { socket } from "../socket.js";
import { getClientToken } from "../clientToken.js";

function ParticipantList({ participants, myRole }) {
  const amIHost = myRole === "host";
  const myToken = getClientToken();

  function makeModerator(userId) {
    socket.emit("assign_role", { userId: userId, role: "moderator" });
  }

  function makeParticipant(userId) {
    socket.emit("assign_role", { userId: userId, role: "participant" });
  }

  function removeUser(userId) {
    const confirmed = window.confirm("Remove this participant from the room?");
    if (confirmed) {
      socket.emit("remove_participant", { userId: userId });
    }
  }

  function makeHost(userId) {
    const confirmed = window.confirm("Transfer host role to this user?");
    if (confirmed) {
      socket.emit("transfer_host", { userId: userId });
    }
  }

  return (
    <div className="panel">
      <h3>Participants ({participants.length})</h3>

      {participants.map((p) => (
        <div className="participant-row" key={p.userId}>
          <div>
            {p.username}
            <span className={`role-badge role-${p.role}`}>{p.role}</span>
            {p.isConnected === false && <span className="role-badge role-participant">offline</span>}
            {p.userId === myToken && <span> (you)</span>}
          </div>

          {amIHost && p.userId !== myToken && (
            <div className="participant-actions">
              {p.role !== "moderator" && (
                <button onClick={() => makeModerator(p.userId)}>Make Mod</button>
              )}
              {p.role === "moderator" && (
                <button onClick={() => makeParticipant(p.userId)}>Demote</button>
              )}
              <button onClick={() => makeHost(p.userId)}>Make Host</button>
              <button onClick={() => removeUser(p.userId)}>Remove</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default ParticipantList;
