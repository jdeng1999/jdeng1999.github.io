---
title: "2026 年的 Docker Compose：真正重要的最佳实践"
description: 超越基础的 docker-compose up。生产级配置、密钥管理、健康检查、profiles 以及多阶段构建，这些才是真正拉开差距的地方。
pubDatetime: 2026-02-05T10:00:00Z
tags:
  - docker
  - devops
  - containers
  - backend
draft: false
featured: true
---

`docker-compose up` 是你学会的第一条命令。接下来的东西——网络、密钥、健康检查、面向不同环境的 profiles——才是区分"能跑起来"和"可以上生产"的关键。

## 干净的基础结构

```yaml file=compose.yml
name: my-app

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: production # multi-stage target // [!code highlight]
    environment:
      NODE_ENV: production
    env_file: .env.production # never hardcode credentials // [!code highlight]
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy # wait for DB to be ready // [!code highlight]
    restart: unless-stopped

  db:
    image: postgres:17-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  postgres_data:

secrets:
  db_password:
    file: ./secrets/db_password.txt
```

## 多阶段构建：更少的 MB，更高的安全性

生产用的 Dockerfile 里绝不应该包含开发工具：

```dockerfile file=Dockerfile
# Stage 1: dependencies and build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci                    # [!code highlight]
COPY . .
RUN npm run build

# Stage 2: minimal final image
FROM node:22-alpine AS production  # [!code ++]
WORKDIR /app                       # [!code ++]
                                   # [!code ++]
# Only copy what's necessary       # [!code ++]
COPY --from=builder /app/dist ./dist  # [!code ++]
COPY --from=builder /app/node_modules ./node_modules  # [!code ++]
                                   # [!code ++]
USER node                          # do not run as root // [!code ++]
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

体积上的差别可以是从 **600 MB → 80 MB**。

## 为不同环境准备 profiles

借助 `profiles`，你可以根据场景启用服务，而不必维护多份 Compose 文件：

```yaml file=compose.yml
services:
  api:
    # no profile = always active
    build: .

  adminer:
    image: adminer
    profiles: [dev, debug] # only in dev // [!code highlight]
    ports:
      - "8080:8080"

  prometheus:
    image: prom/prometheus
    profiles: [monitoring] # only when you need it // [!code highlight]
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
```

```bash
# Only bring up API + DB
docker compose up

# Bring up with dev tools
docker compose --profile dev up

# Entire monitoring stack
docker compose --profile monitoring up
```

## 真正管用的健康检查

基础的 `depends_on` 只等待容器**启动**，并不等待服务**就绪**。这个区别至关重要：

```yaml file=compose.yml
services:
  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s # initial grace period // [!code highlight]

  worker:
    build: .
    depends_on:
      redis:
        condition: service_healthy # wait for green healthcheck // [!code highlight]
```

## 网络：默认隔离

每个 `compose.yml` 都会创建自己的网络。若要让彼此独立的服务栈互相通信：

```yaml file=compose.yml
networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true # no internet access // [!code highlight]

services:
  nginx:
    networks: [frontend, backend] # the only one touching both networks

  api:
    networks: [backend] # isolated from the outside // [!code highlight]

  db:
    networks: [backend] # ditto
```

## 上线前的检查清单

- [ ] 敏感变量放进 `secrets`，或放在仓库之外的 `.env` 里
- [ ] 已启用多阶段构建
- [ ] 所有关键服务都设置了 `restart: unless-stopped`
- [ ] 配置了健康检查，并设置了恰当的 `start_period`
- [ ] `depends_on` 搭配 `condition: service_healthy`
- [ ] 容器内使用非 root 用户（`USER node`、`USER app`）
- [ ] 持久化数据使用命名卷（生产环境不要用 bind mount）
- [ ] 根据容器内存配置 `--max-old-space-size`

> 教程里的 `compose.yml` 和生产环境里的 `compose.yml`，差别不在行数——而在于你是否知道哪些地方会出故障，并且提前做了应对。
