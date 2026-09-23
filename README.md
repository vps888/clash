# 极简 Clash 订阅一键部署 CF Worker

这个项目用 Cloudflare Worker 生成 Clash/Mihomo 订阅。代理节点和规则文件保存在 Cloudflare KV，客户端通过一个带 Token 的地址获取订阅。

## 工作原理

选择静态住宅出口时，请求链路是：

```text
Clash 客户端 → 第一跳代理服务器（VLESS Reality）→ 静态住宅 IP（SOCKS5）→ 目标网站
```

只选择第一跳节点时，不经过静态住宅代理。订阅有四个策略组：`静态IP`、`海外加速`、`灵活调整` 和 `兜底流量`。`静态IP` 组只包含静态住宅节点，供需要稳定美国 IP 的场景手动选择；`海外加速` 组包含第一跳和订阅节点，供媒体和大流量下载等不需要静态 IP 的场景使用；`灵活调整` 组可在海外加速和 `DIRECT` 之间手动切换；`兜底流量` 组接管未命中其他规则的流量，可选择 `DIRECT`、静态IP或海外加速，默认选择静态IP。

直连、灵活调整和海外加速规则会直接展开到主订阅的 `rules:` 段；广告规则通过 `rule-providers` 在线加载，避免主配置被几万条广告规则撑大。

## 部署

需要 Node.js、Cloudflare 账号，以及一个已接入 Cloudflare 的域名。

```bash
git clone https://github.com/vps888/clash.git
cd clash
npx wrangler login
chmod +x scripts/setup.sh
./scripts/setup.sh
```

第一次运行会创建本地 `sub.json`。编辑它，填写第一跳代理和静态住宅信息，再次运行：

```bash
./scripts/setup.sh
```

脚本会创建 KV、上传配置、设置访问 Token 并部署 Worker，最后输出订阅地址：

```text
https://你的域名/sub?token=自动生成的Token
```

已有部署需要更新时，在项目目录执行：

```bash
./scripts/deploy.sh
```

## 配置文件

编辑 `sub.json`：

- `server.server`：第一跳代理服务器地址，建议使用海外加速节点；
- `server.uuid`：第一跳代理服务器的 VLESS UUID；
- `server.publicKey`：Reality 公钥；
- `server.servername`：Reality SNI；
- `static`：一个或多个静态住宅 IP、端口、用户名和密码。

规则文件可以直接编辑：

- `direct-rules.txt`：自定义国内直连规则；
- `streaming-rules.txt`：海外加速（媒体、Telegram 等）规则；
- `flexible-rules.txt`：自用服务规则，可在“海外加速”和 `DIRECT` 之间手动切换。

广告拦截使用公开维护的 Adblock4limbo 规则集，不再上传或维护本地广告规则文件。

`sub.json`、Token 和代理账号密码不会提交到 GitHub。

详细配置、DNS、规则加载和更新说明见：[使用说明](docs/guide.md)。
