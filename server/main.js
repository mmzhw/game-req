import fs from 'fs'
import path from 'path'
import http from 'http'
import https from 'https'
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
console.log('process.env.NODE_ENV',process.env.NODE_ENV)
let isDev = process.env.NODE_ENV === 'dev'

/* 创建Koa应用实例 */
const app = new Koa()
const router = new Router()

const UPLOAD_DIR = path.resolve(isDev ? './server' : './', './uploads')
const STATIC_DIST = path.resolve('./', './dist')
const HTTPS_KEY = path.resolve(isDev ? './server' : './dist', './111.119.248.34.key')
const HTTPS_CER = path.resolve(isDev ? './server' : './dist', './111.119.248.34_cer.crt')
const HTTPS_CA = path.resolve(isDev ? './server' : './dist', './111.119.248.34_ca.crt')
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
        try {
            exec(`rm -rf ${STATIC_DIST}`)
            console.log('已删除,解压',files.file.filepath, UNZIP_DIST_DIR)
            let res = await compressing.zip.uncompress(files.file.filepath, UNZIP_DIST_DIR)
            console.log('已解压，开始重启服务')
            await axios({ method: 'post', url: 'http://127.0.0.1:3001/restart' })
            if (res) {
                ctx.body = files.file.filepath + '上传解压成功'
            } else {
                ctx.body = files.file.filepath
            }
        } catch (e) {
            ctx.body = files.file.filepath + '解压失败'
            console.error(e.message)
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
const mainServer = http.createServer({ }, app.callback())
// const mainServer = https.createServer({ key: HTTPS_KEY, cert: HTTPS_CER, ca: HTTPS_CA }, app.callback());


const websocketServer = new WebSocket.Server({ server: mainServer })
websocketServer.on('connection', (ws) => {
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
mainServer.listen(3000, () => {
    let port = mainServer.address().port
    console.log('应用实例，访问地址为 http://localhost:' + port)
})
