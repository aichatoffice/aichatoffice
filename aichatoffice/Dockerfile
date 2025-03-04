ARG APP=aichatoffice
ARG TURBO=turboone

## UI build stage
FROM reg.smvm.cn/appbase/node:18-alpine3.17 AS ui-builder

# 通过 -build-arg USE_NEW_FILE_PERMISSION=true 来修改
ARG USE_NEW_FILE_PERMISSION=false
WORKDIR ${APP}/ui

COPY ui/package.json ui/package-lock.json ui/.npmrc ./

RUN yarn config set registry https://registry.npmmirror.com \
    && yarn install

ENV NODE_ENV production
ENV CI_COMMIT_SHORT_SHA "v1"

COPY ui .

RUN yarn run build


FROM reg.smvm.cn/appbase/golang-build:1.21-alpine3.17 AS builder

ARG APP
ENV GO111MODULE=on
ENV GOPROXY=https://goproxy.cn,direct

ENV TZ Asia/Shanghai
WORKDIR ${APP}

COPY --from=ui-builder /ui/dist ./ui/dist/

COPY . .
ARG TARGETOS
ARG TARGETARCH

RUN GO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH make build \
    && mkdir /data/ \
    && mkdir /data/files/ \
    && mkdir /data/leveldbstore/ \
    && mv ./bin/*  /data/ \
    && mv ./config  /data/ \
    && mv ./resource /data/

# 运行阶段
# TODO 执行后续传入的二进制包
FROM reg.smvm.cn/appbase/alpine:3.16.2 as final
ARG APP
ARG TURBO
ENV APP=${APP}
ENV TURBO=${TURBO}
ENV WORKDIR=/data
WORKDIR ${WORKDIR}
COPY --from=builder ${WORKDIR}/ ./
# 传入极速版sdk包
COPY ./scripts/turbo/* ./
RUN chmod +x ./turboone.sh
RUN chmod +x ./turboone

ENV TZ Asia/Shanghai

EXPOSE 9001
EXPOSE 8080
#执行两个服务
ENTRYPOINT ["sh", "./turboone.sh"]


