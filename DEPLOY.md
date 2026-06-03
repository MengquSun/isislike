# 部署到公网（Netlify 前端 + Render 后端）

别人要在自己手机/电脑上打开你的网站，需要：

| 组件 | 托管平台 | 作用 |
|------|----------|------|
| **前端** (React) | [Netlify](https://www.netlify.com) | 公网网址，例如 `https://isislike.netlify.app` |
| **后端** (FastAPI + RDKit) | [Render](https://render.com) | API，Netlify **不能**跑 Python/RDKit |
| **数据库** | Supabase（已有） | 已在云端，无需再部署 |

---

## 第 0 步：代码放到 GitHub

1. 在 GitHub 新建仓库（例如 `isislike`）
2. 本地项目根目录执行（不要提交 `.env` 和 `node_modules`）：

```bash
cd "/Users/mengqusun/Desktop/澳赛诺/isislike"
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/你的用户名/isislike.git
git push -u origin main
```

---

## 第 1 步：部署后端（Render）

### 方式 A：Blueprint（推荐）

1. 打开 [render.com](https://render.com) → **New +** → **Blueprint**
2. 连接 GitHub 仓库 [MengquSun/isislike](https://github.com/MengquSun/isislike)，自动读取 `render.yaml`
3. 创建时填写环境变量（见下表）

### 方式 B：已有 Web Service（你当前的 `isislike`）

在 **Settings** 里确认（_build 失败多半是 Docker 上下文不对_）：

| 项 | 正确值 |
|----|--------|
| **Runtime** | Docker |
| **Root Directory** | 留空 |
| **Dockerfile Path** | `./Dockerfile`（仓库**根目录**这份，见下文） |
| **Docker Build Context** | `.`（仓库根目录） |
| **Health Check Path** | `/health` |

不要用 `backend/Dockerfile` 却把 Context 设成仓库根目录——`COPY requirements.txt` 会失败。

**Environment** 里添加：

| 变量 | 值 |
|------|-----|
| `SUPABASE_URL` | `https://lgwofoudcmtnhrjnequv.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `backend/.env` 里的 `sb_secret_...` |
| `CORS_ORIGINS` | 先 `http://localhost:5173`，Netlify 上线后再加站点 URL |

保存后 **Manual Deploy** → **Clear build cache & deploy**。

---

### 环境变量（Blueprint / Web Service 通用）

3. 创建服务时填写环境变量（**Secret**，不要公开）：

| 变量 | 值 |
|------|-----|
| `SUPABASE_URL` | `https://lgwofoudcmtnhrjnequv.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | 你的 `sb_secret_...` |
| `CORS_ORIGINS` | 先填 `http://localhost:5173`（Netlify 域名出来后再改） |

4. 等待 Docker 构建完成（约 5–15 分钟，含 RDKit）
5. 记下 API 地址，例如：`https://isislike-api.onrender.com`
6. 浏览器打开 `https://isislike-api.onrender.com/health` → 应看到 `{"status":"ok",...}`

**免费版注意：** 15 分钟无访问会休眠，首次打开要等 ~30 秒唤醒。

---

## 第 2 步：部署前端（Netlify）

1. 打开 [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**
2. 选 **GitHub** → 选仓库 `isislike`
3. Netlify 会自动读 `netlify.toml`，确认：

| 设置 | 值 |
|------|-----|
| Base directory | `frontend`（若未自动识别，手动填） |
| Build command | `npm ci && npm run build` |
| Publish directory | `frontend/dist` |

4. **Environment variables**（构建前必加）：

| Key | Value |
|-----|--------|
| `VITE_CHEMINFORMATICS_API_URL` | `https://isislike-api.onrender.com`（你的 Render 地址，**不要**末尾 `/`） |

5. **Deploy site**
6. 得到网址，例如：`https://random-name-123.netlify.app`

---

## 第 3 步：打通前后端

1. **Render** → 你的 API 服务 → **Environment** → 更新 `CORS_ORIGINS`：

```text
https://你的站点.netlify.app,http://localhost:5173
```

（多个用英文逗号，不要空格；已支持 `*.netlify.app` 正则，但建议写上主域名。）

2. **Netlify** → **Deploys** → **Trigger deploy** → **Clear cache and deploy site**（若改过 API 地址）

3. 用手机/别的电脑打开 Netlify 链接，试 **See All**、**Save Structure**

---

## 给别人用的链接

直接发 Netlify 地址即可，例如：

`https://isislike.netlify.app`

对方无需安装任何东西，浏览器即可访问。

---

## 常见问题

| 问题 | 处理 |
|------|------|
| 页面能开，列表/API 报错 | 检查 `VITE_CHEMINFORMATICS_API_URL`；Render 是否已唤醒 `/health` |
| CORS 错误 | 在 Render 的 `CORS_ORIGINS` 加上 Netlify 完整 URL |
| Netlify 构建失败 / 内存不足 | 重试 Deploy；或 Site settings → Build → 提高 memory（付费计划） |
| Render 构建很慢 | 正常，RDKit + Docker 首次较久 |
| 压缩项目失败 | 不要 zip `node_modules`；用 Git 推送（见上文） |

---

## 自定义域名（可选）

- **Netlify**：Domain settings → Add custom domain
- **Render**：Settings → Custom Domain（API 子域，如 `api.yourdomain.com`）
- 然后把 `VITE_CHEMINFORMATICS_API_URL` 改成 `https://api.yourdomain.com`
