/* eslint-env node */
const { randomBytes } = require('node:crypto')
const env = { GAME_REQ_SUPERVISOR_TOKEN: randomBytes(32).toString('hex') }

module.exports = {
    apps: [
        { name: 'server', script: '/opt/server/maintenance/launch.js', cwd: '/opt/server', kill_timeout: 10000, env },
        { name: 'update-supervisor', script: '/opt/server/maintenance/update/supervisor.js', cwd: '/opt/server', env }
    ]
}
