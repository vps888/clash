# 极简 Clash 订阅一键部署 CF Worker

## 一键部署

需要准备：Node.js、一个已接入 Cloudflare 的域名，以及 Cloudflare 账号。

```bash
git clone https://github.com/vps888/clash.git
cd clash
npx wrangler login
chmod +x scripts/setup.sh
./scripts/setup.sh
```

第一次运行会自动复制模板：

```text
sub.json.template → sub.json
```

编辑 `sub.json`，填写第一跳代理服务器和静态住宅 IP 信息，然后再次运行：

```bash
./scripts/setup.sh
```

脚本会自动完成：

1. 创建 KV namespace；
2. 生成本地 Wrangler 配置；
3. 上传 `sub.json`、`ad-rules.txt` 和 `direct-rules.txt` 到 KV；
4. 自动生成并设置 `SUB_TOKEN`；
5. 部署 Worker 到填写的域名。

部署完成后脚本会输出订阅地址：

```text
https://你的域名/sub?token=自动生成的Token
```

## 编辑 `sub.json`

模板中需要修改：

- `server.server`：第一跳代理服务器地址，建议使用三网优化的代理服务器；
- `server.uuid`：第一跳代理服务器对应的 VLESS UUID；
- `server.publicKey`：Reality 公钥；
- `server.servername`：Reality SNI；
- `static`：静态住宅 IP、端口、用户名和密码。

可以在 `static` 数组中添加多个静态住宅出口。密码、UUID 和静态代理信息只保存在本地 `sub.json`，不会提交到 GitHub。

### 代理链路

`server` 和 `static` 采用链式代理方式：

```text
Clash 客户端 → 第一跳代理服务器（server）→ 静态住宅 IP（static）→ 目标网站
```

其中：

- `server` 是第一跳 VLESS Reality 服务器，负责接收客户端连接；
- `static` 是第二跳 SOCKS5 静态住宅出口；
- 三网优化策略组中的静态住宅节点都会先经过 `server`，再从对应的静态住宅 IP 出口访问目标网站；
- 只选择第一跳代理服务器节点时，请求不会经过 `static`；
- 添加多个 `static` 节点后，可以在 `三网优化` 组中切换不同的静态住宅出口。

订阅只有两个策略组：

```text
国内直连
三网优化
```

广告规则单独保存在 `ad-rules.txt`，可以按需编辑。每行是一条 Clash/Mihomo 规则，格式例如：

```text
DOMAIN-SUFFIX,example-ad.com
DOMAIN-KEYWORD,advert
```

这些规则会自动转换为 `REJECT`，不会出现第三个策略组。

广告规则和国内直连规则都不会直接展开到主订阅中。Worker 会生成 `rule-providers`，由客户端单独加载：

```text
主订阅：/sub?token=...
广告规则：/rules/ads.txt?token=...
国内直连规则：/rules/direct.txt?token=...
```

客户端会缓存这些规则，并按每天一次的周期检查更新。这样可以明显减小主订阅的配置大小，同时仍然可以分别维护广告规则和国内直连规则。Clash Meta、Mihomo、Clash Verge Rev 等支持 `rule-providers` 的客户端可以使用；过旧的 Clash 内核可能不支持。

### 国内直连规则

国内直连规则单独保存在 `direct-rules.txt`，可以按需编辑。文件中的每一行是一条 Clash/Mihomo 规则，例如：

```text
DOMAIN-SUFFIX,example.cn
DOMAIN-KEYWORD,intranet
IP-CIDR,10.0.0.0/8
```

Worker 会通过 `/rules/direct.txt` 单独提供这份规则，主订阅只引用：

```yaml
- RULE-SET,direct,国内直连
```

规则匹配顺序是：自定义国内直连规则 → `GEOIP,CN` 兜底 → `三网优化`。如果 `direct-rules.txt` 留空，仍然会保留 `GEOIP,CN` 规则。

## 文件说明

```text
worker.js              Worker 入口
sub.json.template      配置模板，可提交
sub.json               私有配置，不提交
ad-rules.txt            广告规则，可直接编辑
direct-rules.txt        国内直连规则，可直接编辑
scripts/setup.sh       一键初始化和部署
scripts/deploy.sh      已有配置时重复部署
wrangler.toml          公共占位模板
wrangler.local.toml    自动生成的本地配置，不提交
```

已有 `sub.json` 时，可直接重新上传并部署：

```bash
./scripts/deploy.sh
```

只部署代码、不上传配置：

```bash
./scripts/deploy.sh --skip-upload
```

## 安全提醒

不要提交以下文件或内容：

- `sub.json`；
- VLESS UUID；
- Reality 私钥或敏感参数；
- 静态住宅代理用户名和密码；
- `SUB_TOKEN`。

旧 edgetunnel 的 `_worker.js` 不参与本项目运行。
