import fs from 'fs'
import path from 'path'
import https from 'https'
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
import { WebSocketServer } from 'ws'

let singleWs = null
console.log('process.env.NODE_ENV', process.env.NODE_ENV)
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

const sleep = async (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms))
}
const axiosContent = async (bodys = []) => {
    for (let i = 0; i < bodys.length; i++) {
        let body = bodys[i]
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
        singleWs && singleWs.send(body.account + ' ' + body.name + ' ' + rData)
        if (body.intervalTime) {
            await sleep(Number(body.intervalTime))
        }
    }
}

router
    .post('/api', (ctx) => {
        if (!ctx.request.body?.reqData || !ctx.request.body?.reqData?.length) {
            ctx.body = '数据异常'
            return
        }
        axiosContent(ctx.request.body.reqData)
        ctx.body = '正在处理，结果查看ws信息'
    })
    .post('/restart', async (ctx) => {
        try {
            await axios({ method: 'post', url: 'http://127.0.0.1:3001/restart' })
            ctx.body = '已通知重启'
        } catch (e) {
            ctx.body = '重启失败'
            console.error(e.message)
        }
    })
    .post('/upload', async (ctx) => {
        // 获取上传文件
        const files = ctx.request.files
        try {
            exec(`rm -rf ${STATIC_DIST}`)
            console.log('已删除,解压', files.file.filepath, UNZIP_DIST_DIR)
            let res = await compressing.zip.uncompress(files.file.filepath, UNZIP_DIST_DIR)

            // 移动dist目录下的server.js和watch.js文件到当前目录
            const distServerJs = path.resolve(UNZIP_DIST_DIR, 'dist/server.js')
            const distWatchJs = path.resolve(UNZIP_DIST_DIR, 'dist/watch.js')
            const currentServerJs = path.resolve('./server.js')
            const currentWatchJs = path.resolve('./watch.js')

            if (fs.existsSync(distWatchJs)) {
                fs.renameSync(distWatchJs, currentWatchJs)
                console.log('已移动 watch.js 文件到当前目录')
            }
            if (fs.existsSync(distServerJs)) {
                fs.renameSync(distServerJs, currentServerJs)
                console.log('已解压并移动文件，开始重启服务')
                await axios({ method: 'post', url: 'http://127.0.0.1:3001/restart' })
            }

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
        // 获取上传的文件
        const files = ctx.request.files
        // 将上传的文件复制到NODE_SERVER_FILE指定的位置，强制覆盖
        exec('cp -f ' + files.file.filepath + ' ' + NODE_SERVER_FILE)
        // 向本地3001端口发送重启服务的请求
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

/* 创建挂载Koa应用程序的https服务 */
// 检查证书文件是否存在
const hasCertFiles = fs.existsSync(HTTPS_KEY) && fs.existsSync(HTTPS_CER) && fs.existsSync(HTTPS_CA)

let mainServer
if (hasCertFiles) {
    // 如果证书文件存在，则创建HTTPS服务器
    const options = {
        key: fs.readFileSync(HTTPS_KEY),
        cert: fs.readFileSync(HTTPS_CER),
        ca: fs.readFileSync(HTTPS_CA)
    }
    mainServer = https.createServer(options, app.callback())
    console.log('Using HTTPS server')
} else {
    // 如果证书文件不存在，则回退到HTTP服务器
    mainServer = http.createServer(app.callback())
    console.log('Using HTTP server (certificates not found)')
}

const websocketServer = new WebSocketServer({ server: mainServer })
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
    if (hasCertFiles) {
        console.log('应用实例，访问地址为 https://localhost:' + port)
    } else {
        console.log('应用实例，访问地址为 http://localhost:' + port)
    }
})
