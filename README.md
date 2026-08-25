# 极简 Clash 订阅一键部署 CF Worker

这个项目用 Cloudflare Worker 生成 Clash/Mihomo 订阅。代理节点和规则文件保存在 Cloudflare KV，客户端通过一个带 Token 的地址获取订阅。

## 工作原理

选择静态住宅出口时，请求链路是：

```text
Clash 客户端 → 第一跳代理服务器（VLESS Reality）→ 静态住宅 IP（SOCKS5）→ 目标网站
```

只选择第一跳节点时，不经过静态住宅代理。订阅有三个策略组：`国内直连`、`三网优化` 和 `流媒体`。

广告规则、国内直连规则和流媒体规则通过 `rule-providers` 单独加载，不会撑大主订阅。

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

- `server.server`：第一跳代理服务器地址，建议使用三网优化代理；
- `server.uuid`：第一跳代理服务器的 VLESS UUID；
- `server.publicKey`：Reality 公钥；
- `server.servername`：Reality SNI；
- `static`：一个或多个静态住宅 IP、端口、用户名和密码。

规则文件可以直接编辑：

- `ad-rules.txt`：广告拦截规则；
- `direct-rules.txt`：自定义国内直连规则。
- `streaming-rules.txt`：流媒体和 Telegram 规则。

`sub.json`、Token 和代理账号密码不会提交到 GitHub。

详细配置、DNS、规则加载和更新说明见：[使用说明](docs/guide.md)。
