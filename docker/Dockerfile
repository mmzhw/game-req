FROM node:24

WORKDIR /opt/server

COPY server/ .

RUN npm install -g pm2

EXPOSE 3000 3001

CMD ["sh", "-c", "pm2 start server.js && pm2 start watch.js && pm2 logs"]