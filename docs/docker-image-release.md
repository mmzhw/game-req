# Docker 镜像构建与发布

本文记录在本机没有 Docker 的情况下，通过 Linux 虚拟服务器构建并发布 `mmzhw51/gm-game-req` 镜像的流程。

## 环境说明

- 本地项目目录：`D:\codetools\game-req`
- 构建服务器：`192.168.200.130`
- SSH 端口：`22`
- SSH 用户：`root`
- Docker Hub 仓库：`mmzhw51/gm-game-req`
- 容器服务端口：`3000`
- 持久化目录：`/opt/server/data`

不要将 SSH 密码、Docker Hub 密码、管理员密码或业务数据写入脚本、Git 提交、构建上下文和日志。

## 实际连接方式

本机可以使用 Windows OpenSSH 连接服务器：

```powershell
ssh root@192.168.200.130
```

自动化发布时使用 Python `paramiko`，原因如下：

- 本机没有安装 Docker，必须在远端服务器构建。
- Windows OpenSSH 不适合在无人值守命令中自动输入密码。
- `paramiko` 可以通过 SFTP 上传构建上下文，并通过 SSH 执行远端 Docker 命令。
- 密码从环境变量读取，不写入 Python 文件或仓库。

确认本机已安装：

```powershell
python -c "import paramiko; print(paramiko.__version__)"
Test-NetConnection 192.168.200.130 -Port 22
```

## 安全读取 SSH 密码

在 PowerShell 中交互式读取密码：

```powershell
$securePassword = Read-Host "SSH password" -AsSecureString
$credential = [System.Net.NetworkCredential]::new("", $securePassword)
$env:GAME_REQ_BUILD_SSH_PASSWORD = $credential.Password
```

发布完成后清除：

```powershell
Remove-Item Env:GAME_REQ_BUILD_SSH_PASSWORD
```

不要把密码直接写进 `.ps1`、`.py`、README 或终端历史。

## 发布前检查

确认版本、工作区和测试：

```powershell
git status --short
node -p "require('./package.json').version"
pnpm run type-check
pnpm run build-only
node --test server/games.test.js server/items.test.js server/admin/*.test.js server/checkin/*.test.js server/update/*.test.js
node server/zip.js
```

已经发布过的版本号不要重复使用。修改 `package.json` 后，应重新构建前端和更新包。

## 创建构建上下文

Dockerfile 会复制 `server/dist`，因此打包前必须先完成前端构建。

在本地创建精简压缩包：

```powershell
$version = node -p "require('./package.json').version"
$stamp = Get-Date -Format "yyyyMMddHHmmss"
$archive = Join-Path $env:TEMP "gm-game-req-$version-$stamp.tar.gz"

tar -czf $archive `
  --exclude=.git `
  --exclude=node_modules `
  --exclude=server/data `
  --exclude=server/uploads `
  --exclude=server/dist.zip `
  --exclude=server/release.zip `
  --exclude=.idea `
  --exclude='*.log' `
  .
```

构建上下文不得包含：

- `server/data`
- 管理员数据库
- 签到 Cookie、账号和密码
- TLS 私钥
- 本地日志
- Git 目录
- `node_modules`

## 上传构建上下文

下面的 PowerShell 片段通过 `paramiko` SFTP 上传文件。远端每次使用唯一临时目录，避免误删其他任务文件。

```powershell
$env:GAME_REQ_BUILD_ARCHIVE = $archive
$env:GAME_REQ_BUILD_VERSION = $version
$env:GAME_REQ_BUILD_STAMP = $stamp

@'
import os
import paramiko

host = "192.168.200.130"
version = os.environ["GAME_REQ_BUILD_VERSION"]
stamp = os.environ["GAME_REQ_BUILD_STAMP"]
remote_archive = f"/tmp/gm-game-req-{version}-{stamp}.tar.gz"
remote_dir = f"/tmp/gm-game-req-{version}-{stamp}"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(
    host,
    username="root",
    password=os.environ["GAME_REQ_BUILD_SSH_PASSWORD"],
    timeout=15,
)

sftp = client.open_sftp()
sftp.put(os.environ["GAME_REQ_BUILD_ARCHIVE"], remote_archive)
sftp.close()

command = (
    f"mkdir -p {remote_dir} "
    f"&& tar -xzf {remote_archive} -C {remote_dir} "
    f"&& test -f {remote_dir}/docker/Dockerfile"
)
stdin, stdout, stderr = client.exec_command(command)
print(stdout.read().decode("utf-8", "replace"))
error = stderr.read().decode("utf-8", "replace")
if error:
    print(error)
status = stdout.channel.recv_exit_status()
client.close()
raise SystemExit(status)
'@ | python -
```

## 远端构建镜像

在服务器上同时生成版本标签和 `latest`：

```bash
cd /tmp/gm-game-req-<版本>-<时间戳>
DOCKER_BUILDKIT=1 docker build \
  --progress=plain \
  -f docker/Dockerfile \
  -t mmzhw51/gm-game-req:<版本> \
  -t mmzhw51/gm-game-req:latest \
  .
```

构建时间较长时，不要让本地 SSH 日志转发进程一直占用前台。可在远端后台构建并记录状态：

```bash
nohup sh -c '
  cd /tmp/gm-game-req-<版本>-<时间戳> &&
  DOCKER_BUILDKIT=1 docker build \
    --progress=plain \
    -f docker/Dockerfile \
    -t mmzhw51/gm-game-req:<版本> \
    -t mmzhw51/gm-game-req:latest \
    . > /tmp/gm-game-req-<版本>-build.log 2>&1
  echo $? > /tmp/gm-game-req-<版本>-build.status
' >/dev/null 2>&1 &
```

查看状态：

```bash
cat /tmp/gm-game-req-<版本>-build.status 2>/dev/null || echo RUNNING
tail -n 30 /tmp/gm-game-req-<版本>-build.log
```

状态文件内容为 `0` 才表示构建成功。

## 冒烟验证

推送前启动临时容器：

```bash
docker run -d \
  --name gm-game-req-smoke \
  -p 127.0.0.1:39068:3000 \
  mmzhw51/gm-game-req:<版本>
```

检查健康接口和首页：

```bash
curl -fsS http://127.0.0.1:39068/api/update/health
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:39068/
docker logs --tail 50 gm-game-req-smoke
```

预期：

```text
{"id":"image-<版本>","version":"<版本>"}
200
```

验证后删除临时容器：

```bash
docker rm -f gm-game-req-smoke
```

不要使用生产数据卷执行冒烟验证。

## 推送 Docker Hub

服务器需要提前登录 Docker Hub：

```bash
docker login
```

推送版本标签和 `latest`：

```bash
docker push mmzhw51/gm-game-req:<版本>
docker push mmzhw51/gm-game-req:latest
```

记录输出中的 digest，并核对两个标签：

```bash
docker manifest inspect mmzhw51/gm-game-req:<版本> | sha256sum
docker manifest inspect mmzhw51/gm-game-req:latest | sha256sum
```

两个清单哈希应完全一致。

## 更新实际容器

构建服务器不一定是应用部署服务器。先执行：

```bash
docker ps -a --format '{{.Names}}|{{.Image}}|{{.Ports}}'
```

如果没有 `gm-game-req` 容器，只发布镜像，不要猜测部署参数。

在实际部署服务器上，先记录现有容器的端口、环境变量、重启策略和数据卷：

```bash
docker inspect <容器名>
```

必须保留：

```text
/opt/server/data
```

典型更新流程：

```bash
docker pull mmzhw51/gm-game-req:<版本>
docker stop <容器名>
docker rm <容器名>
docker run -d \
  --name <容器名> \
  --restart unless-stopped \
  -p <原端口>:3000 \
  -v <原数据目录>:/opt/server/data \
  mmzhw51/gm-game-req:<版本>
```

不要在没有确认原容器配置和数据卷的情况下直接删除或重建生产容器。

## 常见问题

### 本机没有 Docker

本机只负责构建前端、运行测试和制作构建上下文。Docker 构建、冒烟验证和推送都在 `192.168.200.130` 上完成。

### OpenSSH 无法自动输入密码

交互操作使用：

```powershell
ssh root@192.168.200.130
```

自动化操作使用 `paramiko`，密码从临时环境变量读取。

### Windows 输出出现 GBK 编码错误

远端 Docker 日志可能包含 Unicode 进度字符，直接在本地 Python 中 `print` 可能触发：

```text
UnicodeEncodeError: 'gbk' codec can't encode character
```

推荐将构建输出写入远端日志，再按需读取。确实需要输出时，可降级不可显示字符：

```python
text = remote_bytes.decode("utf-8", "replace")
print(text.encode("ascii", "replace").decode())
```

### 服务器磁盘不足

构建前检查：

```bash
df -h /
docker system df
```

不要未经确认直接执行 `docker system prune -a`，该命令可能删除其他项目依赖的镜像和构建缓存。

### 镜像发布成功但页面没有新功能

依次确认：

1. `package.json` 版本是否已更新。
2. `server/dist` 是否在打包前重新构建。
3. 远端构建上下文是否为最新文件。
4. 容器实际使用的是版本标签还是旧的 `latest` 缓存。
5. 容器是否已重新拉取镜像并重建。

