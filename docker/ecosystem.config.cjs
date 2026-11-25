/* eslint-env node */
module.exports = {
    apps: [
        { name: 'server', script: '/opt/server/maintenance/launch.js', cwd: '/opt/server', kill_timeout: 10000 },
        { name: 'update-supervisor', script: '/opt/server/maintenance/update/supervisor.js', cwd: '/opt/server' }
    ]
}
