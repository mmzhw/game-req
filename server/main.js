import fs from 'fs'
import path from 'path'
import http from 'http'
import Koa from 'koa'
import axios from 'axios'
import qs from 'qs'
import Router from 'koa-router'
import koaStatic from 'koa-static'
import { koaBody } from 'koa-body'
import cors from 'koa2-cors'
import compressing from 'compressing'
import { exec } from 'child_process'
import WebSocket from 'ws'

let singleWs = null
let isDev = process.env.NODE_ENV === 'dev'

/* 创建Koa应用实例 */
const app = new Koa()
const router = new Router()

const UPLOAD_DIR = path.resolve('./', './uploads')
const STATIC_DIST = path.resolve('./', './dist')
const HTTPS_KEY = path.resolve(isDev ? './server' : './dist', './_.youxiang.com.key')
const HTTPS_CRT = path.resolve(isDev ? './server' : './dist', './_.youxiang.com.crt')
const UNZIP_DIST_DIR = path.resolve('./')
const NODE_SERVER_FILE = path.resolve('./dist', './server.js')

app.use(cors())
    // .use(bodyParser())
    .use(
        koaBody({
            multipart: true,
            formidable: {
                uploadDir: UPLOAD_DIR, // 设置文件上传目录
                keepExtensions: true // 保持文件的后缀
            }
            // onFileBegin:(name,file)=>{
            //     console.log(name,file)
            // }
        })
    )
    /* 指定一个目录作为静态资源的根目录（亦即站点根目录） */
    .use(koaStatic(STATIC_DIST))
    .use(router.routes())
    .use(router.allowedMethods())

const reqFun = async (body) => {
    let option = {
        method: body.realReqMethod,
        url: body.realReqUrl
    }
    if (body.params) {
        option.params = body.params
    }
    if (body.data) {
        option.data = body.data
    }
    if (body.formData) {
        option.data = qs.stringify(body.formData)
    }
    let result = await axios(option)
    let rData = ''
    if (result && result.data) {
        try {
            rData = JSON.stringify(result.data)
        } catch (e) {}
    }
    singleWs && singleWs.send(body.name + ' ' + rData)
    return result?.data
}
const delayReqFun = async (bodys, time) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            reqFun(bodys)
            resolve('')
        }, time)
    })
}
let intervalId = null

router
    .post('/api', async (ctx) => {
        if (!ctx.request.body?.reqData || !ctx.request.body?.reqData?.length) {
            ctx.body = '数据异常'
            return
        }
        ctx.body = await reqFun(ctx.request.body.reqData[0])
    })
    .post('/apibatch', async (ctx) => {
        if (!ctx.request.body?.reqData || !ctx.request.body?.reqData?.length) {
            ctx.body = '数据异常'
            return
        }
        await reqFun(ctx.request.body.reqData[0])
        for (let i = 1; i < ctx.request.body.reqData.length; i++) {
            await delayReqFun(ctx.request.body.reqData[i], ctx.request.body.interval)
        }
        ctx.body = '开始发送'
    })
    .post('/apiInterval', async (ctx) => {
        if (!ctx.request.body?.reqData || !ctx.request.body?.reqData?.length) {
            ctx.body = '数据异常'
            return
        }
        if (ctx.request.body.interval) {
            if (intervalId) {
                ctx.body = '存在定时器id为' + intervalId
                return
            }
            intervalId = setInterval(() => {
                reqFun(ctx.request.body.reqData[0])
            }, ctx.request.body.interval)
        }
        ctx.body = '定时器id为' + intervalId
    })
    .post('/closeinterval', async (ctx) => {
        if (intervalId) {
            clearInterval(intervalId)
            intervalId = null
            ctx.body = '关闭定时器成功'
            return
        }
        ctx.body = '不存在定时器'
    })
    .post('/upload', async (ctx) => {
        // 获取上传文件
        const files = ctx.request.files
        console.log('接受到上传', files.file.filepath)
        try {
            exec(`rm -rf ${STATIC_DIST}`)
            let res = await compressing.zip.uncompress(files.file.filepath, UNZIP_DIST_DIR)
            axios({ method: 'post', url: 'http://localhost:3001/restart' })
            if (res) {
                ctx.body = files.file.filepath + '上传解压成功'
            } else {
                ctx.body = files.file.filepath
            }
        } catch (e) {
            ctx.body = files.file.filepath + '解压失败'
        }
    })
    .post('/uploadServer', async (ctx) => {
        const files = ctx.request.files
        exec('cp -f ' + files.file.filepath + ' ' + NODE_SERVER_FILE)
        axios({ method: 'post', url: 'http://localhost:3001/restart' })
        ctx.body = files.file.filepath + '上传成功'
    })
    .post('/controlsh', async (ctx) => {
        axios({
            method: 'post',
            url: 'http://localhost:3001/controlsh',
            data: { cmd: ctx.request.body.cmd }
        })
        ctx.body = '已执行'
    })

/* 创建挂载Koa应用程序的http服务 */
const main = http.createServer(
    {
        key: fs.readFileSync(HTTPS_KEY),
        cert: fs.readFileSync(HTTPS_CRT)
    },
    app.callback()
)

const wsServer = new WebSocket.Server({ server: main })
wsServer.on('connection', (ws) => {
    console.log('[WEBSOCKET SERVER] connection()')
    singleWs = ws
    singleWs.on('message', (message) => {
        const result = String(message)
        console.log(`[WEBSOCKET SERVER] Received: ${result}`)
        if (result === 'ping') {
            singleWs && singleWs.send('pong')
        }
    })
    singleWs.on('error', (error) => {
        console.log('[WEBSOCKET SERVER] disconnect error')
    })
    singleWs.on('close', (error) => {
        console.log('[WEBSOCKET SERVER] disconnect close')
    })
})

/* 开始监听/启动服务（指定3000端口与成功回调） */
main.listen(3000, () => {
    console.log('listening on port 3000 ...')
})
