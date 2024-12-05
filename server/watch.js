import http from 'http'
import Koa from 'koa'
import Router from 'koa-router'
import { exec } from 'child_process'
import bodyParser from 'koa-bodyparser'

/* 创建Koa应用实例 */
const app = new Koa()
const router = new Router()

app.use(bodyParser()).use(router.routes()).use(router.allowedMethods())

router
    .post('/restart', async (ctx) => {
        exec('pm2 restart server')
        ctx.body = '已执行'
    })
    .post('/controlsh', async (ctx) => {
        let sh = ctx.request.body?.cmd
        if (sh) {
            exec(sh)
            ctx.body = '已执行'
            return
        }
        ctx.body = '数据异常'
    })

/* 创建挂载Koa应用程序的http服务 */
const server = http.createServer(app.callback())

/* 开始监听/启动服务（指定3000端口与成功回调） */
server.listen(3001, () => {
    console.log('listening on port 3001 ...')
})
