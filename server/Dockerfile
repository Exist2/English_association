FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache font-noto-cjk

# 先复制依赖文件，利用 Docker 缓存层
COPY package.json package-lock.json ./
RUN npm ci --production

# 复制构建产物
COPY dist/ ./dist/

EXPOSE 3004

CMD ["node", "dist/main.js"]
