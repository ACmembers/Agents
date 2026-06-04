"""TTS 引擎 — Edge TTS（免费，无需 API Key）"""

import asyncio
import io
import tempfile
from pathlib import Path


async def synthesize_edge_tts(
    text: str, voice: str = "zh-CN-XiaoxiaoNeural"
) -> bytes | None:
    """使用 Edge TTS 合成语音，返回 mp3 bytes"""
    try:
        import edge_tts
        communicate = edge_tts.Communicate(text, voice)
        mp3_data = bytearray()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                mp3_data.extend(chunk["data"])
        return bytes(mp3_data)
    except ImportError:
        print("[TTS] edge-tts 未安装，跳过语音合成")
        return None
    except Exception as e:
        print(f"[TTS] 合成失败: {e}")
        return None


async def synthesize_to_file(
    text: str, output_path: str, voice: str = "zh-CN-XiaoxiaoNeural"
) -> bool:
    """合成到文件"""
    data = await synthesize_edge_tts(text, voice)
    if data:
        Path(output_path).write_bytes(data)
        return True
    return False
