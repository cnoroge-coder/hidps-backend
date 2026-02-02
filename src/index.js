import express from 'express';
import http from 'http';
import { startWebSocketServer } from './websocket/server.js';
import dotenv from 'dotenv';
import { startMockAgent } from './mock/mockAgent.js';

if (process.env.MOCK_AGENT === 'true') {
  startMockAgent('agent_001');
}

dotenv.config();

const app = express();
const server = http.createServer(app);

startWebSocketServer(server);

server.listen(process.env.PORT, () => {
  console.log(`Backend running on port ${process.env.PORT}`);
});