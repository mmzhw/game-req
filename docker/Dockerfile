FROM node:24-alpine
ARG NPM_CONFIG_REGISTRY=https://registry.npmjs.org
WORKDIR /opt/server/image/runtime

COPY package.json pnpm-lock.yaml ./
RUN apk add --no-cache python3 py3-pip \
    && python3 -m venv /opt/fnat-python \
    && /opt/fnat-python/bin/pip install --no-cache-dir "PyPasser[vision]==1.1.0"
RUN --mount=type=cache,target=/root/.npm npm install --global --no-audit --no-fund pnpm@10.28.0 pm2@6.0.13
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
COPY server/server.js server/items.js server/games.js ./
COPY server/admin/ ./admin/
COPY server/checkin/ ./checkin/
COPY server/update/ ./update/
RUN node --input-type=module -e "import fs from 'node:fs'; import sharp from 'sharp'; const {version}=JSON.parse(fs.readFileSync('package.json')); fs.writeFileSync('.release.json', JSON.stringify({id:'image-'+version,version})); await sharp({create:{width:1,height:1,channels:3,background:'#fff'}}).png().toBuffer()"

WORKDIR /opt/server
COPY package.json ./
COPY docker/launch.js docker/ecosystem.config.cjs ./maintenance/
COPY server/update/common.js server/update/supervisor.js ./maintenance/update/
COPY server/dist/ ./image/dist/
RUN ln -s /opt/server/image/runtime runtime && ln -s /opt/server/image/dist dist \
    && mkdir -p uploads data/checkin

ENV TZ=Asia/Shanghai
ENV CHECKIN_DATA_DIR=/opt/server/data/checkin
ENV FNAT_PYTHON=/opt/fnat-python/bin/python
ENV GAME_REQ_MANAGED_RELEASE=1
ENV GAME_REQ_DATA_DIR=/opt/server/data

VOLUME ["/opt/server/data"]
EXPOSE 3000
CMD ["pm2-runtime", "start", "/opt/server/maintenance/ecosystem.config.cjs"]
