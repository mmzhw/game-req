FROM keymetrics/pm2:24-alpine
# 设置工作目录为 /opt/server
WORKDIR /opt/server
# 将本地 server 目录的内容复制到容器的 /opt/server 目录
COPY server/ /opt/server

# 设置时区为上海
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

EXPOSE 3000
CMD ["sh", "-c", "pm2 start server.js && pm2 start watch.js && pm2 logs"]
