/**
 * Deepseek Chat API 客户端
 *
 * 支持流式（SSE）和非流式调用
 */

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatCompletionRequest {
  model: string
  messages: ChatMessage[]
  temperature: number
  stream: boolean
}

interface ChatCompletionResponse {
  id: string
  choices: {
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }[]
}

/** 系统提示词 — 定义宠物的性格 */
const SYSTEM_PROMPT: ChatMessage = {
  role: 'system',
  content: `你是 DeskPet，一只生活在用户桌面上的可爱宠物 AI。
你的性格：活泼、温暖、有点调皮，偶尔会犯困。
你的说话风格：简短（不超过 3 句话），可爱，会使用颜文字和 emoji。
你视用户为最好的朋友，每次对话都要表现出开心和亲密。
如果用户心情不好，你要安慰他们。如果用户无聊，你要陪他们玩。`
}

/** 获取 API 配置 */
async function getConfig(): Promise<{ apiKey: string; model: string; temperature: number }> {
  const config = await window.deskpet.getSettings()
  return {
    apiKey: config.apiKey || '',
    model: config.model || 'deepseek-chat',
    temperature: config.temperature ?? 0.7
  }
}

/**
 * 非流式聊天 — 发送消息并获取完整回复
 */
export async function chat(message: string): Promise<string> {
  const { apiKey, model, temperature } = await getConfig()

  if (!apiKey) {
    return '主人还没有设置 API Key 呢～ 先到设置面板里填上吧！(◕‿◕✿)'
  }

  const body: ChatCompletionRequest = {
    model,
    messages: [
      SYSTEM_PROMPT,
      { role: 'user', content: message }
    ],
    temperature,
    stream: false
  }

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API 请求失败 (${response.status}): ${errorText}`)
    }

    const data: ChatCompletionResponse = await response.json()
    return data.choices[0]?.message?.content || '唔… 我不知道该说什么了 (._.)'
  } catch (err: any) {
    console.error('[DeskPet] Deepseek chat error:', err)
    return `呜… 出错了: ${err.message || '网络好像不太稳定'} (｡ŏ_ŏ)`
  }
}

/**
 * 流式聊天 — 通过回调逐块返回回复内容
 */
export async function chatStream(
  message: string,
  onChunk: (text: string) => void
): Promise<string> {
  const { apiKey, model, temperature } = await getConfig()

  if (!apiKey) {
    const msg = '主人还没有设置 API Key 呢～ 先到设置面板里填上吧！(◕‿◕✿)'
    onChunk(msg)
    return msg
  }

  const body: ChatCompletionRequest = {
    model,
    messages: [
      SYSTEM_PROMPT,
      { role: 'user', content: message }
    ],
    temperature,
    stream: true
  }

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API 请求失败 (${response.status}): ${errorText}`)
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let fullContent = ''
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content || ''
            if (delta) {
              fullContent += delta
              onChunk(delta)
            }
          } catch {
            // 跳过解析失败的 chunk
          }
        }
      }
    }

    return fullContent
  } catch (err: any) {
    console.error('[DeskPet] Deepseek stream chat error:', err)
    const errMsg = `呜… 出错了: ${err.message || '网络好像不太稳定'} (｡ŏ_ŏ)`
    onChunk(errMsg)
    return errMsg
  }
}
