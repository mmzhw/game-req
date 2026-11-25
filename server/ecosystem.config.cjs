/* eslint-env node */
const path = require('node:path')
module.exports = {
    apps: [
        {
            name: 'game-req-checkin-local',
            script: './server.js',
            cwd: __dirname,
            env: { NODE_ENV: 'production' },
            autorestart: true,
            restart_delay: 3000,
            time: true,
            out_file: path.join(__dirname, 'data/checkin/logs/output.log'),
            error_file: path.join(__dirname, 'data/checkin/logs/error.log')
        }
    ]
}
