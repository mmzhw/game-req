const fs = require("fs");
const path = require("path"); // 引入node内置的path模块
const http = require("http"); // 引入node内置的http模块
const Koa = require("koa"); // 引入Koa
const axios = require("axios");
const qs = require("qs");
const Router = require("koa-router");
const koaStatic = require("koa-static");
// const bodyParser = require('koa-bodyparser')
const { koaBody } = require("koa-body");
const cors = require("koa2-cors");
const compressing = require("compressing");
const { exec } = require("child_process");
const WebSocket = require("ws");
let singleWs = null;

/* 创建Koa应用实例 */
const app = new Koa();
const router = new Router();

app.use(cors())
    // .use(bodyParser())
    .use(
        koaBody({
            multipart: true,
            formidable: {
                uploadDir: path.resolve("./"), // 设置文件上传目录
                keepExtensions: true // 保持文件的后缀
            }
            // onFileBegin:(name,file)=>{
            //     console.log(name,file)
            // }
        })
    )
    /* 指定一个目录作为静态资源的根目录（亦即站点根目录） */
    .use(koaStatic(path.resolve("./", "./dist")))
    .use(router.routes())
    .use(router.allowedMethods());

const reqFun = async (body) => {
    let option = {
        method: body.realReqMethod,
        url: body.realReqUrl
    };
    if (body.params) {
        option.params = body.params;
    }
    if (body.data) {
        option.data = body.data;
    }
    if (body.formData) {
        option.data = qs.stringify(body.formData);
    }
    let result = await axios(option);
    singleWs.send(body.name + " " + result?.data);
    return result?.data;
};
const delayReqFun = async (bodys, time) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            reqFun(bodys);
            resolve("");
        }, time);
    });
};
let intervalId = null;

router
    .post("/api", async (ctx) => {
        if (!ctx.request.body?.reqData || !ctx.request.body?.reqData?.length) {
            ctx.body = "数据异常";
            return;
        }
        ctx.body = await reqFun(ctx.request.body.reqData[0]);
    })
    .post("/apibatch", async (ctx) => {
        if (!ctx.request.body?.reqData || !ctx.request.body?.reqData?.length) {
            ctx.body = "数据异常";
            return;
        }
        await reqFun(ctx.request.body.reqData[0]);
        for (let i = 1; i < ctx.request.body.reqData.length; i++) {
            await delayReqFun(ctx.request.body.reqData[i], ctx.request.body.interval);
        }
        ctx.body = "开始发送";
    })
    .post("/apiInterval", async (ctx) => {
        if (!ctx.request.body?.reqData || !ctx.request.body?.reqData?.length) {
            ctx.body = "数据异常";
            return;
        }
        if (ctx.request.body.interval) {
            if (intervalId) {
                ctx.body = "存在定时器id为" + intervalId;
                return;
            }
            intervalId = setInterval(() => {
                reqFun(ctx.request.body.reqData[0]);
            }, ctx.request.body.interval);
        }
        ctx.body = "定时器id为" + intervalId;
    })
    .post("/closeinterval", async (ctx) => {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
            ctx.body = "关闭定时器成功";
            return;
        }
        ctx.body = "不存在定时器";
    })
    .post("/upload", async (ctx) => {
        // 获取上传文件
        const files = ctx.request.files;
        console.log("接受到上传", files.file.filepath);
        try {
            let res = await compressing.zip.uncompress(files.file.filepath, "./");
            if (res) {
                ctx.body = files.file.filepath + "上传解压成功";
            } else {
                ctx.body = files.file.filepath + res;
            }
        } catch (e) {
            ctx.body = files.file.filepath + "解压失败";
        }
        exec("rm -rf " + files.file.filepath);
    })
    .post("/uploadServer", async (ctx) => {
        const files = ctx.request.files;
        exec("rm -rf ./server.js");
        exec("mv -i " + files.file.filepath + " ./server.js");
        exec("rm -rf " + files.file.filepath);
        ctx.body = files.file.filepath + "上传成功";
        axios({ method: "post", url: "http://localhost:3001/restart" });
    })
    .post("/controlsh", async (ctx) => {
        axios({
            method: "post",
            url: "http://localhost:3001/controlsh",
            data: { cmd: ctx.request.body.cmd }
        });
        ctx.body = "已执行";
    });

const options = {
    key: fs.readFileSync("_.youxiang.com.key"),
    cert: fs.readFileSync("_.youxiang.com.crt")
};

/* 创建挂载Koa应用程序的http服务 */
const server = http.createServer(options, app.callback());

const wsServer = new WebSocket.Server({ server });
wsServer.on("connection", (ws) => {
    console.log(`[WEBSOCKET SERVER] connection()`);
    singleWs = ws;
    singleWs.on("message", (message) => {
        console.log(`[WEBSOCKET SERVER] Received: ${message}`);
    });
    singleWs.on("error", (error) => {
        singleWs = null;
    });
    singleWs.on("close", (error) => {
        singleWs = null;
    });
});

/* 开始监听/启动服务（指定3000端口与成功回调） */
server.listen(3000, () => {
    console.log("listening on port 3000 ...");
});
