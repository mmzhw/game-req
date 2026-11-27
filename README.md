## 首次启动

新容器不预置用户名和密码。使用全新数据卷首次打开页面时，填写用户名、密码和确认密码即可创建唯一管理员。密码只要求非空。成功后直接登录，注册入口关闭。首次注册前仅在本机或可信内网开放服务。

本地开发使用 Node.js 24，在项目根目录分别运行 `pnpm run node:dev` 和 `pnpm run dev`，打开 Vite 显示的地址。本地数据默认位于 `server/data`。

## Docker 部署与页面更新

通过 `192.168.200.130` 构建并发布 Docker Hub 镜像的完整步骤见 [Docker 镜像构建与发布](docs/docker-image-release.md)。

首次启用新版后台请换镜像，不要在旧版上单独上传前端包。在项目根目录运行 `pnpm run build-only` 后构建镜像：

```sh
docker build -f docker/Dockerfile -t game-req .
docker run -d --name game-req --restart unless-stopped -p 127.0.0.1:3000:3000 \
  -v /your/game-req-data:/opt/server/data game-req
docker logs game-req
```

- 持久化整个 `/opt/server/data`，包括管理员和会话 (`app.db`)、游戏配置与物品数据 (`items.db`)，以及 `checkin/` 下的签到配置、锁和记录。备份时先停止容器，再复制整个数据目录；备份含凭据，请勿公开。
- 如果旧版仅挂载 `/opt/server/data/checkin`，先停止旧容器并备份，将原挂载目录的内容迁至新数据卷的 `checkin/` 子目录，再启动新容器。原有签到配置会继续生效，避免两个实例同时执行。已有管理员的情况下换容器不会重新开放注册。
- 线上使用 HTTPS 或可信内网。使用 HTTPS 反向代理时保留原始 `Host`、支持 `/ws` 升级、覆盖 `X-Forwarded-Proto`，仅在应用端口不能绕过可信代理时设置 `GAME_REQ_TRUST_PROXY=1`。使用应用自带 HTTPS 时，将证书只读挂载至独立目录并设置 `GAME_REQ_TLS_DIR`。
- 忘记管理员密码时，从终端安全读入新密码，经 stdin 执行重置。例如在 Bash 中运行 `read -rs NEW_PASSWORD; printf '%s\n' "$NEW_PASSWORD" | docker exec -i game-req node /opt/server/runtime/admin/reset-password.js; unset NEW_PASSWORD`。重置会撤销此前所有会话，不影响业务数据。
- 网页「服务更新」直接使用管理员登录会话。新版镜像不再需要设置 `GAME_REQ_UPDATE_TOKEN`；容器内部更新进程由镜像自动配置认证。
- 运行 `node server/zip.js`，以当前 `package.json` 的版本生成两个更新包。
- 前端更新：上传 `server/dist.zip`，只更换前端，不重启服务。需要新后台接口时不要单独用此包。
- 服务端更新：上传 `server/release.zip`，包含前端、Node 服务端模块、`package.json` 和 `pnpm-lock.yaml`。容器先用锁文件安装生产依赖，成功后切换并重启；应用未通过健康检查时恢复原版本。进度与结果显示在「服务更新」页。
- 页面更新适用于应用代码及容器内可安装的 Node 依赖。改变 Node、系统库、容器启动逻辑，或需要生命周期安装脚本的依赖时，使用新镜像。页面更新写入当前容器，替换容器前应将对应版本构建为镜像。

镜像构建后可在 Docker 主机运行 `python3 docker/smoke-update.py 镜像名`，验证两种更新包与失败回退。脚本只创建临时容器，不启用签到。

## 游戏管理

首次启动自动迁移内置游戏和 `public/items` 中的物品文件。侧栏「游戏管理」根据数据库动态生成游戏菜单；控制台支持新增、编辑、停用和删除游戏，每个游戏可独立配置任意数量、不同地址和不同参数的功能。在操作列中为对应游戏上传不超过 2 MB 的 UTF-8 `.txt`、`.text` 或 `.json` 文件，确认后整体替换当前物品；也可以进入分页编辑页面新增、修改或删除单条物品。

## 每日签到

侧栏「每日签到」进入站点列表 `/#/checkin`，点击「老王论坛」进入 `/#/checkin/laowang`。支持 Cookie 更新、固定时间或在指定时段内每日随机执行、代理、登录检查和执行记录。后台独立运行，不要求浏览器常开。

本地启动、Cookie 辅助插件和 Docker 持久化说明见 [每日签到说明](server/checkin/README.md)。
