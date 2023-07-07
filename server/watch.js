const http = require('http') // 引入node内置的http模块
const Koa = require('koa') // 引入Koa
const Router = require('koa-router')
const { exec } = require('child_process')
const bodyParser = require('koa-bodyparser')
const path = require('path')

/* 创建Koa应用实例 */
const app = new Koa()
const router = new Router()

app.use(bodyParser()).use(router.routes()).use(router.allowedMethods())

router
    .post('/restart', async (ctx) => {
        exec('pm2 restart 1')
    })
    .post('/controlsh', async (ctx) => {
        let sh = ctx.request.body?.cmd
        if (sh) {
            exec(sh)
        }
    })

/* 创建挂载Koa应用程序的http服务 */
const server = http.createServer(app.callback())

/* 开始监听/启动服务（指定3000端口与成功回调） */
server.listen(3001, () => {
    console.log('listening on port 3001 ...')
})
