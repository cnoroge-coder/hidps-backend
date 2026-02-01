import express from 'express';
import http from 'http';
import { startWebSocketServer } from './websocket/server.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = http.createServer(app);

startWebSocketServer(server);

server.listen(process.env.PORT, () => {
  console.log(`Backend running on port ${process.env.PORT}`);
});