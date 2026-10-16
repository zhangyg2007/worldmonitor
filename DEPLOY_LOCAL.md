# WorldMonitor 本地部署文档

> 部署日期：2026-09-16
> 部署机：Ubuntu 24.04，24核 / 125GB RAM
> 版本：koala73/worldmonitor (git clone, commit @ clone time)

## 架构总览

```
┌─────────────────────────────────────────────────────┐
│                 http://localhost:3000                 │
│                   (nginx + supervisord)              │
├────────────────────────┬─────────────────────────────┤
│  Vite SPA (dist/)      │  Node.js API (:46123)        │
│  50+ route handlers    │  50+ API endpoints           │
├────────────────────────┴─────────────────────────────┤
│  redis-rest proxy (:8079, 127.0.0.1 only)            │
│  redis:7 (:6379, internal Docker network)            │
├─────────────────────────────────────────────────────┤
│  ais-relay (:3004, internal) — live vessel WebSocket │
└─────────────────────────────────────────────────────┘

Host services used by the stack:
┌─────────────────────────────────────────────────────┐
│  Ollama qwen3.8:27b  (http://localhost:11434)       │
│  → LLM summarization / intelligence assessments     │
│  (containers reach host via 172.17.0.1)             │
└─────────────────────────────────────────────────────┘

Existing dev middleware (shared, running from Sep 10):
┌─────────────────────────────────────────────────────┐
│  postgres:16   :5432  (db: yuxi)                    │
│  redis:7       :6379  (no auth, AOF)                │
│  neo4j:5.26    :7474  (Yuxi KB)                     │
│  milvus:2.5.6  :19530 (Yuxi KB)                     │
│  minio         :9000  (Yuxi KB + Milvus)            │
│  elasticsearch :9200  (Yuxi KB)                     │
│  etcd          (Milvus dependency)                  │
└─────────────────────────────────────────────────────┘
```

> **注意：** WorldMonitor 的 Redis 栈是独立的（worldmonitor-redis + worldmonitor-redis-rest），
> 与 Yuxi 开发的 `redis:7` 容器端口隔离，互不干扰。

## 容器清单

| 容器名                 | 镜像                  | 端口映射              | 用途                          |
|------------------------|-----------------------|-----------------------|-------------------------------|
| `worldmonitor`         | worldmonitor:latest   | 3000→8080            | 主应用 (nginx + Node API)     |
| `worldmonitor-redis`   | redis:7-alpine        | 6379 (internal)      | 数据缓存                      |
| `worldmonitor-redis-rest` | worldmonitor-redis-rest:latest | 127.0.0.1:8079→80 | Upstash REST 代理 |
| `worldmonitor-ais-relay`  | worldmonitor-ais-relay:latest  | 3004 (internal)  | AIS WebSocket relay           |

## 文件清单

### 本项目生成/修改

| 路径                                                        | 说明                          |
|-------------------------------------------------------------|-------------------------------|
| `.env`                                                      | 4 个强制密钥 + LLM 配置       |
| `docker-compose.override.yml`                                | LLM 注入 (gitignored)         |
| `Dockerfile` — 3 处 sha256 pin → `node:24-alpine` tag       | 修复 registry 拉取失败        |
| `Dockerfile.relay` — 2 处 sha256 pin → tag                  | 同上                          |
| `docker/Dockerfile.redis-rest` — 1 处 sha256 pin → tag      | 同上                          |
| `DEPLOY_LOCAL.md` (本文件)                                    | 部署文档                      |

### 已构建镜像

| 镜像名                        | 大小 (约) | 状态   |
|-------------------------------|-----------|--------|
| `worldmonitor:latest`         | ~800MB    | 已构建 |
| `worldmonitor-ais-relay`      | ~250MB    | 已构建 |
| `worldmonitor-redis-rest`     | ~120MB    | 已构建 |

### 关键源码路径（git clone 原样）

```
api/                    # 50+ API route handlers (JS/TS)
server/                 # 服务端共享模块
  _shared/              # 缓存、LLM、限流、认证
scripts/                # 195 个 seeder .mjs 脚本
src/                    # Vite + React 前端
  components/           # UI 组件
  app/                  # 页面
  services/             # 前端数据服务
  config/               # 前端配置
docker/                 # nginx、supervisord、redis-rest 代理
docs/                   # Mintlify 文档
data/                   # 静态数据
public/                 # 静态资源
```

## 密钥（.env）

| 变量                 | 用途                              | 生成方式              |
|----------------------|-----------------------------------|-----------------------|
| `RELAY_SHARED_SECRET`| AIS relay 鉴权                    | `openssl rand -hex 32`|
| `REDIS_PASSWORD`     | Redis AUTH (--requirepass)        | `openssl rand -hex 32`|
| `REDIS_TOKEN`        | redis-rest 代理 bearer token      | `openssl rand -hex 32`|
| `WM_SESSION_SECRET`  | 浏览器匿名 session 签名           | `openssl rand -hex 32`|
| `LLM_API_URL`        | → `http://172.17.0.1:11434/v1/chat/completions` | Ollama  |
| `LLM_API_KEY`        | → `ollama-local`                  | 固定值                |
| `LLM_MODEL`          | → `qwen3.8:27b`                   | Ollama 本地模型       |

## 常用操作

```bash
cd /root/projects/worldmonitor

# 查看状态
docker compose ps

# 查看日志
docker compose logs -f --tail=50 worldmonitor

# 重启全栈
docker compose restart

# 重建镜像（代码变更后）
docker compose build --no-cache
docker compose up -d

# 重新跑 seeders
./scripts/run-seeders.sh

# 停止并清理 volume（会丢数据）
docker compose down -v

# 只停不删
docker compose down

# 查看 Redis 数据量
set -a; . .env; set +a
docker exec worldmonitor-redis redis-cli -a "$REDIS_PASSWORD" --no-auth-warning DBSIZE
```

## API 快速验证

```bash
# 主页面
curl -I http://localhost:3000/

# 侧车健康
curl http://localhost:3000/api/sidecar-health

# Bootstrap 数据（前端首屏加载）
curl http://localhost:3000/api/bootstrap

# 地震数据
curl http://localhost:3000/api/earthquakes

# 国家情报简报（接受匿名 session）
curl http://localhost:3000/api/intelligence/v1/get-country-intel-brief
```

## 数据源状态（无 API key 时）

| 状态           | 数据域                              |
|----------------|-------------------------------------|
| 🟢 无需 key    | 地震、天气、自然事件、UNHCR 难民、  |
|                | 预测市场、稳定币、加密、支出、      |
|                | 气候异常、海底电缆、BIS、网络威胁   |
| 🔴 需 key      | 航空 (AviationStack)、金融 (Finnhub/|
|                | EIA/FRED)、冲突 (ACLED)、火灾       |
|                | (NASA FIRMS)、AIS 船舶 (AISStream)、|
|                | 互联网中断 (Cloudflare Radar)       |

> 所有缺失 key 的功能会优雅降级（返回空数据或跳过），不会崩溃。

## 已知问题 / 限制

1. **Dockerfile sha256 pin 已修改**：原版用完整 sha256 固定 node:24-alpine，但本机
   Docker registry 无法拉取该 digest（超时）。已改为 `node:24-alpine` tag 引用，
   功能等价但失去 supply-chain pin。如需恢复 pin，确保 registry 可达后改回。

2. **部分 seeder 因网络/403 失败**：BIS (HTTP 403)、BLS、BocValet、Aviation
   等数据源无法从本机访问或需 API key。这些不影响 dashboard 核心功能。

3. **195 个 seeder 运行时间较长**：bundle 类 seeder 内部逐个拉取上游，每个可能
   耗时数分钟。完整一轮约 1-3 小时。建议配置 cron 定时刷新：
   ```
   */30 * * * * cd /root/projects/worldmonitor && ./scripts/run-seeders.sh >> /tmp/wm-seeders.log 2>&1
   ```

4. **磁盘**：构建占用约 2GB（Docker 层），Redis 数据量小（MB 级）。

## 与 Yuxi 知识库集成方案

> 以下方案基于 Yuxi 代码分析（`/data/hermesworkspace/projects/Yuxi/`），
> 详细 API 需进一步确认后实施。

### 现状

- **WorldMonitor**：静态 Redis 缓存模式。Seeder 拉取 → Redis → API handler 读取。
  没有语义检索能力。
- **Yuxi KB**：基于腾讯开源项目，含 Milvus 向量检索 + Neo4j 图谱 + ES 全文搜索。
  后端 `backend/package/yuxi/` 含 `knowledge/`（KB CRUD、Milvus 检索、图谱）、
  `agents/`（agent 框架 + skills）、`storage/`（多后端存储）。

### 集成方向

1. **LLM 情报增强**（推荐）
   - WorldMonitor 的 `server/_shared/llm.ts` 已支持 OpenAI-compatible endpoint。
   - 当前指向 Ollama qwen3.8:27b（通用摘要）。
   - 可将 Yuxi KB 的 agent 作为"增强 LLM"接入：WorldMonitor 的 intelligence
     assessment 调用 Yuxi API → Yuxi 检索相关 KB 文档 → 返回引用化摘要。

2. **KB 作为 WorldMonitor 的文档后端**
   - 将 worldmonitor 的 `docs/`、`CONCEPTS.md`、`ARCHITECTURE.md` 导入 Yuxi KB。
   - 前端增加 "Ask" 面板，通过 Yuxi 的 RAG API 做项目内检索问答。
   - 需要 Yuxi 后端暴露 REST API（检查 `server/` 路由）。

3. **数据流双向**
   - WorldMonitor 的 seed 数据（地震、冲突、市场等）可写入 Yuxi KB 作为
     结构化知识条目。
   - Yuxi 图谱（Neo4j）可补充地缘关系网络，增强 WorldMonitor 的
     country-intel-brief 内容。

### 下一步

- [ ] 确认 Yuxi API 可用（启动 Yuxi docker-compose.prod.yml，检查 REST 端点）
- [ ] 测试 Yuxi 检索质量（导入 worldmonitor docs 后测试）
- [ ] 实现 WorldMonitor → Yuxi 代理端点（`api/kb-search.ts`）
- [ ] 前端 Ask 面板（可选）
