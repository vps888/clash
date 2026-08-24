# 独立 Clash 订阅 Worker

这个仓库只包含一个独立的 Cloudflare Worker，不依赖原 edgetunnel 项目的 `_worker.js`、旧规则或旧订阅逻辑。

Worker 的工作方式：

```text
Clash 客户端
    ↓
https://你的域名/sub?token=你的SUB_TOKEN
    ↓
Worker 读取 KV 中的 optimized-subscription.json
    ↓
返回 Clash YAML
```

Worker 代码不会保存 UUID、静态住宅 IP、代理用户名或密码。这些内容都放在每个使用者自己的 KV 中。

## 当前实例

本仓库对应的当前实例是：

```text
https://vps888.qzz.io/sub?token=你的SUB_TOKEN
```

当前实例的 KV 和 `SUB_TOKEN` 属于仓库维护者。其他人不要直接使用这个 KV，也不要把自己的配置上传到这个 namespace。

## 策略组

订阅只包含两个可选择策略组：

```text
国内直连
三网优化
```

广告域名通过 `REJECT` 规则拦截，`REJECT` 是规则动作，不会显示为第三个策略组。

## 给自己单独部署

### 1. 准备环境

需要：

- Cloudflare 账号；
- 一个已经接入 Cloudflare 的域名或子域名；
- Node.js；
- Wrangler。

登录自己的 Cloudflare 账号：

```bash
npx wrangler login
```

### 2. 创建自己的 KV

```bash
npx wrangler kv namespace create clash-config
```

复制命令输出的 namespace ID。

### 3. 修改 `wrangler.toml`

把下面三个占位内容替换成自己的值：

```toml
name = "replace-with-your-worker-name"

routes = [
  { pattern = "sub.example.com", custom_domain = true }
]

[[kv_namespaces]]
binding = "KV"
id = "replace-with-your-kv-namespace-id"
```

对应关系：

| 配置项 | 含义 |
| --- | --- |
| `name` | 自己的 Worker 名称，不能与其他 Worker 冲突 |
| `routes.pattern` | 自己的订阅域名，例如 `clash.example.com` |
| `kv_namespaces.id` | 自己创建的 KV namespace ID |

`routes.pattern` 对应的域名必须由当前 Cloudflare 账号管理，并且 DNS 处于代理状态。Custom Domain 绑定成功后，订阅地址是：

```text
https://clash.example.com/sub?token=你的SUB_TOKEN
```

### 4. 准备自己的订阅配置

KV 中的文件名必须是：

```text
optimized-subscription.json
```

其中需要填写自己的：

- HostDare VLESS Reality 地址；
- VLESS UUID；
- Reality 公钥、SNI、短 ID；
- 静态住宅 IP、端口；
- 静态住宅 SOCKS5 用户名和密码；
- 自己需要的 provider。

UUID 和静态代理账号密码属于私有信息，不要写进 public 仓库。

当前仓库只负责运行 Worker，不包含私有配置生成器。可以在本地使用自己的配置生成工具生成 `optimized-subscription.json`，然后上传到 KV。不能把 `custom-subscription.private.json` 或生成后的 JSON 提交到 GitHub。

### 5. 设置订阅 Token

`SUB_TOKEN` 只用于保护订阅地址，与 VLESS UUID 不是一回事：

```bash
npx wrangler secret put SUB_TOKEN
```

输入一个随机长字符串即可。

### 6. 使用部署脚本

仓库提供了 [scripts/deploy.sh](scripts/deploy.sh)，它会先把本地 `optimized-subscription.json` 上传到 KV，再部署 Worker：

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

只设置 Token：

```bash
./scripts/deploy.sh --set-token
```

只部署 Worker、不上传 KV：

```bash
./scripts/deploy.sh --skip-upload
```

只检查 Worker 打包：

```bash
./scripts/deploy.sh --dry-run
```

脚本默认读取：

```text
optimized-subscription.json
wrangler.toml
```

也可以通过环境变量覆盖路径：

```bash
CONFIG_FILE=my-subscription.json ./scripts/deploy.sh
```

脚本不会生成节点配置。使用者需要先在本地生成自己的 `optimized-subscription.json`，再执行部署脚本。

### 7. 手动部署（可选）

```bash
npx wrangler deploy
```

检查 Worker：

```bash
curl https://clash.example.com/health
```

正常应返回：

```text
ok
```

然后把下面地址添加到 Clash：

```text
https://clash.example.com/sub?token=自己的SUB_TOKEN
```

## 安全注意事项

不要将以下内容提交到 public 仓库：

- VLESS UUID；
- Reality 私钥或敏感参数；
- 静态住宅代理用户名和密码；
- 私有订阅地址；
- `optimized-subscription.json`；
- `SUB_TOKEN`。

本仓库的 `.gitignore` 已忽略本地生成的订阅文件和 Wrangler 本地配置。
