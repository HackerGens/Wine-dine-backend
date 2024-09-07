// utils/broadcast.js

let websocketServer = null;

function setWebSocketServer(wsServer) {
  websocketServer = wsServer;
}

function broadcast(message) {
  if (websocketServer) {
    websocketServer.clients.forEach(client => {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }
}

module.exports = {
  setWebSocketServer,
  broadcast,
};
