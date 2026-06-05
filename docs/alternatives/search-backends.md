# 搜索后端备选方案

**状态**：备选（未采用）
**决策时间**：需要更高搜索质量时评估
**主方案**：DuckDuckGo Instant Answer API（免费，零配置）
**切换成本**：低 — 仅需新增 backend 实现 + 配置字段

## 后端对比

| 后端 | API Key | 免费额度 | 付费价格 | 结果来源 | 结构化程度 |
|------|---------|----------|----------|----------|------------|
| **DuckDuckGo** | 不需要 | 无限 | - | Bing + 自有 | 低（纯文本摘要） |
| **SerpAPI** | 需要 | 100 次/月 | ~$50/月 | Google | 高（结构化 JSON） |
| **Bing Search API** | 需要 | 1000 次/月 | ~$7/千次 | Bing | 高（Web + News） |
| **Tavily** | 需要 | 1000 次/月 | ~$0.05/次 | 聚合多源 | 很高（AI 优化摘要） |

## SerpAPI 接入示例

```rust
pub struct SerpApiBackend {
    api_key: String,
    client: reqwest::Client,
}

#[async_trait::async_trait]
impl SearchBackend for SerpApiBackend {
    async fn search(&self, query: &str, limit: u8) -> Result<Vec<SearchResult>> {
        let resp = self.client
            .get("https://serpapi.com/search")
            .query(&[("q", query), ("api_key", &self.api_key), ("num", &limit.to_string())])
            .send().await?;
        let json: serde_json::Value = resp.json().await?;
        let results = json["organic_results"].as_array()
            .map(|arr| arr.iter().map(|r| SearchResult {
                title: r["title"].as_str().unwrap_or("").into(),
                url: r["link"].as_str().unwrap_or("").into(),
                snippet: r["snippet"].as_str().unwrap_or("").into(),
            }).collect())
            .unwrap_or_default();
        Ok(results)
    }
}
```

## Bing Search API 接入示例

```rust
// GET https://api.bing.microsoft.com/v7.0/search?q=...
// Header: Ocp-Apim-Subscription-Key: {key}
// Response: webPages.value[].{name, url, snippet}
```

## 配置扩展

```json
{
  "search": {
    "enabled": true,
    "backend": "serpapi",
    "serpapi_key": "sk-...",
    "bing_key": "",
    "max_results": 3,
    "llm_trigger": true
  }
}
```

## 迁移路径

1. 在 `SearchAdapter::from_config()` 中按 `backend` 字段选择后端
2. 实现 `SerpApiBackend` 和 `BingBackend`
3. 配置面板中增加后端选择下拉框
4. 保留 DuckDuckGo 作为零配置默认值
