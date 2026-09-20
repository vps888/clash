# 使用说明

## 1. 配置格式

`sub.json` 是本地私有配置，复制自 `sub.json.template`。主要字段如下：

```json
{
  "server": {
    "name": "US-HD",
    "server": "第一跳代理服务器地址",
    "port": 443,
    "uuid": "VLESS UUID",
    "servername": "Reality SNI",
    "publicKey": "Reality 公钥",
    "shortId": "",
    "clientFingerprint": "firefox"
  },
  "static": [
    {
      "name": "US-Static161-via-HD",
      "server": "静态住宅 IP",
      "port": 12324,
      "username": "SOCKS5 用户名",
      "password": "SOCKS5 密码"
    }
  ]
}
```

如果需要多个第一跳服务器，可在 `servers` 数组中添加第二个服务器；原有的 `server` 会自动与它合并，重复项会去重。每个静态出口会自动生成一组组合节点，例如 `161-via-HD`、`161-via-HD-2`、`168-via-HD`、`168-via-HD-2`，从而可以分别选择第一跳。服务器账号、UUID 和 Reality 公钥只放在本地私有 `sub.json`，不要提交到 Git。

可以在 `static` 数组中添加多个出口。静态节点会自动使用所选组合对应的第一跳代理作为 `dialer-proxy`。

## 2. 链式代理

选择静态节点时：

```text
Clash 客户端 → server（VLESS Reality）→ static（SOCKS5）→ 目标网站
```

选择第一跳节点时，直接从第一跳代理访问目标网站，不经过 `static`。

## 3. 规则文件

### 广告规则

`ad-rules.txt` 每行一条 Clash/Mihomo 规则，例如：

```text
DOMAIN-SUFFIX,example-ad.com
DOMAIN-KEYWORD,advert
```

这些规则通过 `REJECT` 策略处理。

### 国内直连规则

`direct-rules.txt` 每行一条规则，例如：

```text
DOMAIN-SUFFIX,example.cn
DOMAIN-KEYWORD,intranet
IP-CIDR,10.0.0.0/8
```

自定义规则先匹配，之后还有内置的 `GEOIP,CN` 规则作为兜底。

### 海外加速规则

`streaming-rules.txt` 默认包含 YouTube、Telegram、Netflix、Disney+、Max、Prime Video、Spotify 和 Twitch，也适合大流量下载、AI 等不需要静态 IP 的场景。可以按需添加或删除域名。

这些域名会进入 `海外加速` 策略组；该组使用第一跳和私有订阅节点。需要稳定美国静态 IP 时，手动切换到 `静态IP` 组。Telegram 的部分连接可能使用固定 IP，单靠域名规则不能覆盖所有情况。

订阅内置了以下兜底规则（写入 Worker，无需维护规则文件）：

- `GEOSITE` 分类：AI、Emby、娱乐、成人站点 → `海外加速`；游戏平台下载 → `国内直连`
- `GEOIP` 分类：Telegram、Google、Netflix → `海外加速`
- `GEOIP,CN` → `国内直连`；`MATCH` → `海外加速`（默认流量不经过静态 IP）

Worker 提供四个地址：

```text
/sub?token=...
/rules/ads.txt?token=...
/rules/direct.txt?token=...
/rules/streaming.txt?token=...
```

主订阅会把国内直连和海外加速规则直接展开到 `rules:` 段；广告规则改为通过 `rule-providers` 在线加载，并在 `rules:` 中使用 `RULE-SET,ad-rules,REJECT` 引用。客户端会按 `interval` 定期更新广告资源。三个 `/rules/*.txt` 地址仍保留，方便单独检查规则内容。

## 4. DNS

模板默认使用 fake-ip，仅使用 Cloudflare、Google、Quad9 和 OpenDNS 的境外 DoH，并保留局域网例外：

```yaml
dns:
  enable: true
  ipv6: false
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  use-hosts: true
  default-nameserver:
    - 1.1.1.1
    - 8.8.8.8
  proxy-server-nameserver:
    - https://cloudflare-dns.com/dns-query#海外加速
    - https://dns.google/dns-query#海外加速
  respect-rules: true
  nameserver:
    - https://cloudflare-dns.com/dns-query#海外加速
    - https://dns.google/dns-query#海外加速
  fallback:
    - https://dns.quad9.net/dns-query#海外加速
    - https://doh.opendns.com/dns-query#海外加速
  fake-ip-filter:
    - localhost
    - +.lan
    - +.local
```

`#海外加速` 让 DoH 请求经代理组发送，`default-nameserver` 仅用于启动时解析 DoH 服务器自身的域名。`fake-ip-filter` 中的域名会绕过 fake-ip，因此不应无限添加。

## 5. 更新部署

修改 `sub.json`、`ad-rules.txt` 或 `direct-rules.txt` 后：

```bash
./scripts/deploy.sh
```

只更新 Worker 代码、不上传 KV 配置：

```bash
./scripts/deploy.sh --skip-upload
```

重新设置 Token：

```bash
./scripts/deploy.sh --set-token
```

`scripts/setup.sh` 适合第一次部署，会创建新的 KV namespace。已有 Worker 应使用 `scripts/deploy.sh`，并保留本地 `wrangler.local.toml`。

## 6. 文件和安全

```text
worker.js              Worker 入口
sub.json.template      私有配置模板
sub.json               本地敏感配置，不提交
ad-rules.txt           广告规则
direct-rules.txt       国内直连规则
streaming-rules.txt    海外加速规则
scripts/setup.sh       首次部署
scripts/deploy.sh      更新部署
wrangler.toml          公共占位配置
wrangler.local.toml    本地部署配置，不提交
```

不要把以下内容提交到公开仓库：

- VLESS UUID；
- Reality 私钥或其他敏感参数；
- 静态住宅代理用户名和密码；
- `SUB_TOKEN`；
- `sub.json` 和 `wrangler.local.toml`。
