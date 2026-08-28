const STORAGE_KEY = "watch_party_client_token";

function generateUuid() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getClientToken() {
  let token = localStorage.getItem(STORAGE_KEY);
  if (!token) {
    token = generateUuid();
    localStorage.setItem(STORAGE_KEY, token);
  }
  return token;
}
