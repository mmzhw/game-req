# 每日签到

配置入口：首页点击“每日签到”进入 `/#/checkin` 站点列表，再点击对应站点；老王论坛详情为 `/#/checkin/laowang`。

目前接入老王论坛和 FNAT 内网穿透。每日任务由 Node.js 后台执行，不需要浏览器常开。浏览器只用于首次获取或后续更新登录 Cookie。账号、执行时间、开关、代理和执行记录都在对应站点配置页维护。

FNAT 详情为 `/#/checkin/fnat`。先在同一浏览器手动登录 FNAT，再通过 Cookie 插件获取 `PHPSESSID`，保存后先检查登录态。FNAT 不需要填写浏览器标识；会话过期需重新登录，没有自动验证码登录或免费转盘操作。配置与记录位于签到数据目录下的 `fnat/`，不会覆盖老王论坛数据。

## 本地启动

使用 Node.js 24。原依赖目录由 pnpm 10 安装，首次安装请使用同一主版本；本机已经安装完毕：

~~~powershell
npx --yes pnpm@10.28.0 install
node node_modules/vite/bin/vite.js build
pm2 start server/ecosystem.config.cjs --only game-req-checkin-local
~~~

本地进程名为 game-req-checkin-local，由 PM2 保持运行并在异常退出时重启。关闭配置页面或 Codex 不会主动停止该进程。电脑仍需保持开机和联网。查看与停止：

~~~powershell
pm2 logs game-req-checkin-local
pm2 restart game-req-checkin-local
pm2 stop game-req-checkin-local
~~~

本次已配置账号 mmzhw51，启用北京时间每天 08:00 执行。2026-11-23 的首次真实签到结果已导入为今日记录；下次计划为 2026-11-24 08:00。

## 更新 Cookie

直接复用 QD 签到平台的“获取 Cookies”辅助插件：

1. 在同一浏览器保持老王论坛登录。
2. 右键获取 Cookie 插件，打开“选项”。在匹配地址中另起一行加入当前配置页的来源地址，本地是 http://localhost:3000。保留原有签到平台地址，保存并刷新配置页。
3. 点击配置页“从浏览器获取”，确认插件提示，然后点击“保存配置”。
4. 点击“检查登录态”可只读确认账号和今日状态，不会签到。

插件通过 data-toggle=get-cookie、data-site 和 cookieRaw 消息对接。配置页仅接收当前页面、当前获取操作发出的完整老王论坛 Cookie；Cookie 输入框默认为隐藏显示。后端查询接口不会返回保存的 Cookie 或浏览器标识原文，留空保存会保留原登录信息。

首次验证时的站点浏览器标识已保存。日常更新 Cookie 不需要修改该标识。

## 执行与日志

时区固定为 Asia/Shanghai，不依赖运行主机的时区。开启当天已过执行时间时，从次日开始；若原本已开启，后台在计划时间后重启，会检查当天记录并补执行。每 10 秒检查一次计划。

- 固定时间：每天在所设时间执行，已有配置继续使用原来的固定时间。
- 每日随机：选择当天的起止时间，不能跨天。每个日期在该区间内有一个固定的随机分钟；重启、刷新或更新 Cookie 都不会重抽。当天占用执行名额后，无论结果如何，页面都会显示次日的计划。

每个账号每天先创建排他锁，再进行网络请求；最终签到 POST 前同步写入提交记录。并发、重启、失败和结果不明均不会自动重复提交。当日已有执行记录时，“立即签到”不可用。网络或验证失败会记录到页面，次日按计划继续。

执行记录的“平台请求”展示每一步的时间、耗时、HTTP 状态和错误码，以及最终签到提交的方法、脱敏地址和表单字段、实际响应状态、跳转地址和正文大小。可安全记录的纯文本显示有限长度的预览；HTML、其他非纯文本格式和可能包含凭据的内容不保存正文。Cookie、验证码和浏览器标识不写入诊断记录。支持复制诊断，旧记录只显示当时保存的信息。

后台正常运行时，关闭浏览器不会影响签到。明早可在“执行记录”查看定时执行结果、累计天数和最终提交次数。

## 数据与 Docker

默认数据目录为 server/data/checkin，包含 config.json、runs/ 和本地 PM2 日志。该目录已加入 Git 和 Docker 构建忽略规则。CHECKIN_DATA_DIR 环境变量可以指定其他持久化目录。

迁移到 Docker 时先运行 node node_modules/vite/bin/vite.js build，然后从项目根目录构建：

~~~sh
docker build -f docker/Dockerfile -t game-req .
docker run -d --name game-req --restart unless-stopped -p 3000:3000 \
  --env-file /your/game-req.env \
  -v /your/checkin-data:/opt/server/data/checkin game-req
~~~

环境文件可设置非空的 `GAME_REQ_UPDATE_TOKEN`，用于授权首页的更新与重启操作；不设置则不开放。将本地 server/data/checkin 中的配置和执行记录私下迁移到挂载目录，保留当日锁和记录。“平台请求”里的诊断随 runs/ 记录持久化，替换容器后继续可查。挂载目录包含登录凭据，勿提交或公开。切换时应先停止旧实例的调度，再开启新实例，避免两边同时签到。

## 验证

pnpm run checkin:test 覆盖北京时间调度、跨进程与重启防重复、超时不重试、只读登录检查、凭据不回传及接口来源校验。pnpm run type-check 和 pnpm run build-only 检查前端。

验证码协议按已验证版本实现，不执行下载的 JavaScript。站点脚本版本变化、图片匹配不确定或页面结构异常时停止并记录原因。
