const WebSocket = require('ws')

const wss = new WebSocket.Server({
    port: 3000
})

wss.on('connection', (ws) => {
    console.log(`[SERVER] connection()`)

    ws.on('message', (message) => {
        console.log(`[SERVER] Received: ${message}`)

        ws.send(`ECHO: ${message}`, (error) => {
            if (error) {
                console.log(`[SERVER] error: ${error}`)
            }
        })
    })
})
