# 独立 Clash 订阅 Worker

这个仓库只负责部署独立订阅 Worker，不包含原 edgetunnel 的旧 Worker 和规则代码。

Worker 从 KV 读取 `optimized-subscription.json`，然后返回 Clash YAML。KV 内容包含私有节点和 provider，因此不提交到公开仓库。

## 当前地址

```text
https://vps888.qzz.io/sub?token=你的SUB_TOKEN
```

## 部署

先准备 KV 内容并上传：

```bash
npx wrangler kv key put optimized-subscription.json \
  --path optimized-subscription.json \
  --namespace-id a9be71d039dc4f4ea77d273f97f6911b \
  --remote
```

设置订阅 token：

```bash
npx wrangler secret put SUB_TOKEN
```

部署 Worker：

```bash
npx wrangler deploy
```

## 订阅内容

策略组只有：

- `国内直连`
- `三网优化`

广告域名使用 `REJECT` 规则拦截，不作为第三个策略组显示。

公开仓库不保存代理账号、密码、私有订阅地址或生成后的 KV 配置。
