import { io } from "socket.io-client";

const PROD_API_URL = "https://student-wellness-backend-production.up.railway.app/api";
const API_BASE =
  process.env.REACT_APP_API_URL?.trim() ||
  (window.location.hostname === "localhost" ? "http://localhost:3001/api" : PROD_API_URL);

const normalizeSocketUrl = (value) => {
  if (!value) return "";
  return value.endsWith("/api") ? value.slice(0, -4) : value;
};

const SOCKET_URL = normalizeSocketUrl(process.env.REACT_APP_SOCKET_URL?.trim() || API_BASE);

let studentSocket = null;
let parentSocket = null;

const createSocket = (token) =>
  io(SOCKET_URL, {
    transports: ["websocket", "polling"],
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 12,
    reconnectionDelay: 750,
  });

export const connectStudentSocket = (token) => {
  if (!token) return null;
  if (studentSocket?.connected) return studentSocket;

  if (studentSocket) {
    studentSocket.disconnect();
  }

  studentSocket = createSocket(token);
  return studentSocket;
};

export const getStudentSocket = () => studentSocket;

export const disconnectStudentSocket = () => {
  if (studentSocket) {
    studentSocket.disconnect();
    studentSocket = null;
  }
};

export const connectParentSocket = (token) => {
  if (!token) return null;
  if (parentSocket?.connected) return parentSocket;

  if (parentSocket) {
    parentSocket.disconnect();
  }

  parentSocket = createSocket(token);
  return parentSocket;
};

export const getParentSocket = () => parentSocket;

export const disconnectParentSocket = () => {
  if (parentSocket) {
    parentSocket.disconnect();
    parentSocket = null;
  }
};

export const getSocketBaseUrl = () => SOCKET_URL;
