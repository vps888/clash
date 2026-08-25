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

可以在 `static` 数组中添加多个出口。静态节点会自动使用第一跳代理作为 `dialer-proxy`。

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

### 流媒体规则

`streaming-rules.txt` 默认包含 YouTube、Telegram、Netflix、Disney+、Max、Prime Video、Spotify 和 Twitch。可以按需添加或删除域名。

这些域名会进入 `流媒体` 策略组；该组和 `三网优化` 使用相同的第一跳、静态住宅及私有订阅节点。Telegram 的部分连接可能使用固定 IP，单靠域名规则不能覆盖所有情况。

Worker 提供四个地址：

```text
/sub?token=...
/rules/ads.txt?token=...
/rules/direct.txt?token=...
/rules/streaming.txt?token=...
```

主订阅只引用三个 `rule-providers`，客户端会单独缓存并定期更新规则。需要 Clash Meta、Mihomo、Clash Verge Rev 等支持 `rule-providers` 的内核。

## 4. DNS

模板默认使用 fake-ip，并保留国内首选 DNS、境外 fallback 和局域网例外：

```yaml
dns:
  enable: true
  ipv6: false
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  use-hosts: true
  nameserver:
    - https://sm2.doh.pub/dns-query
    - https://dns.alidns.com/dns-query
  fallback:
    - https://dns.google/dns-query
    - https://cloudflare-dns.com/dns-query
  fallback-filter:
    geoip: true
    geoip-code: CN
    ipcidr:
      - 240.0.0.0/4
      - 127.0.0.1/32
      - 0.0.0.0/32
    domain:
      - +.google.com
      - +.facebook.com
      - +.youtube.com
  fake-ip-filter:
    - localhost
    - +.lan
    - +.local
```

`fallback-filter.domain` 只决定 DNS 使用哪个解析器，不决定请求是否走代理。`fake-ip-filter` 中的域名会绕过 fake-ip，因此不应无限添加。

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
streaming-rules.txt    流媒体规则
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
