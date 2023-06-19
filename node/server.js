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
    console.log("请求参数:", body);
    console.log("请求结果:", result?.data);
    return result?.data;
};

router
    .post("/api", async (ctx) => {
        ctx.body = await reqFun(ctx.request.body);
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
        axios({ method: "post", url: "http://localhost:3001/controlsh", data: { cmd: "pm2 delete all" } })?.data;
        ctx.body = "已执行";
    });

/* 创建挂载Koa应用程序的http服务 */
const server = http.createServer(app.callback());

/* 开始监听/启动服务（指定3000端口与成功回调） */
server.listen(3000, () => {
    console.log("listening on port 3000 ...");
});
