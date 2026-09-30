"""Local FunASR Paraformer sidecar for 16 kHz PCM/WAV chunks."""

from __future__ import annotations

import argparse
import io
import json
import sys
import threading
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import numpy as np


class Transcriber:
    def __init__(self, model_dir: Path, punc_model_dir: Path | None = None, hotword_file: Path | None = None):
        try:
            from funasr import AutoModel
        except ImportError as exc:
            raise RuntimeError("FunASR 运行时未安装") from exc
        self.lock = threading.Lock()
        self.model = AutoModel(model=str(model_dir), device="cpu", disable_update=True)
        self.punc_model = None
        self.punc_model_dir = None
        if punc_model_dir and punc_model_dir.exists():
            self.punc_model = AutoModel(model=str(punc_model_dir), device="cpu", disable_update=True)
            self.punc_model_dir = str(punc_model_dir)
        self.hotwords = []
        if hotword_file and hotword_file.exists():
            self.hotwords = [line.strip() for line in hotword_file.read_text(encoding="utf-8").splitlines() if line.strip()]

    @staticmethod
    def decode_wav(payload: bytes) -> np.ndarray:
        with wave.open(io.BytesIO(payload), "rb") as source:
            channels = source.getnchannels()
            sample_width = source.getsampwidth()
            sample_rate = source.getframerate()
            frames = source.readframes(source.getnframes())
        if sample_rate != 16000 or sample_width != 2:
            raise ValueError("本地转录只接受 16 kHz 16-bit WAV 音频")
        audio = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
        if channels > 1:
            audio = audio.reshape(-1, channels).mean(axis=1)
        return audio

    @staticmethod
    def result_text(results) -> str:
        texts = []
        for result in results or []:
            if isinstance(result, dict):
                text = result.get("text") or result.get("preds") or ""
                if text:
                    texts.append(str(text))
        return "".join(texts).strip()

    def transcribe(self, payload: bytes) -> dict:
        audio = self.decode_wav(payload)
        if audio.size < 160:
            return {"text": "", "rawText": "", "punctuatedText": "", "punctuationApplied": False}
        with self.lock:
            # The renderer already sends short, finalized segments. Passing
            # streaming chunk parameters to that whole segment causes the
            # online decoder to reinterpret the audio and repeat characters.
            results = self.model.generate(
                input=audio,
                batch_size_s=300,
            )
            raw_text = self.result_text(results)
            punctuated_text = raw_text
            if raw_text and self.punc_model is not None:
                try:
                    punctuated_text = self.result_text(self.punc_model.generate(input=raw_text)) or raw_text
                except Exception:
                    # An optional punctuation model must never make ASR unavailable.
                    punctuated_text = raw_text
        return {
            "text": punctuated_text,
            "rawText": raw_text,
            "punctuatedText": punctuated_text,
            "punctuationApplied": bool(self.punc_model is not None and punctuated_text != raw_text),
        }


class Handler(BaseHTTPRequestHandler):
    transcriber: Transcriber

    def send_json(self, status: int, value: dict):
        body = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            transcriber = self.transcriber
            self.send_json(200, {
                "ok": True,
                "model": "FunASR Paraformer 中文流式",
                "punctuation": bool(transcriber.punc_model is not None),
                "hotwords": len(transcriber.hotwords),
            })
        else:
            self.send_json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/transcribe":
            self.send_json(404, {"error": "not found"})
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size <= 0 or size > 20 * 1024 * 1024:
                raise ValueError("音频请求大小无效")
            result = self.transcriber.transcribe(self.rfile.read(size))
            self.send_json(200, result)
        except Exception as exc:
            self.send_json(500, {"error": str(exc)})

    def log_message(self, *_args):
        return


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", required=True, type=Path)
    parser.add_argument("--punc-model", type=Path, default=None)
    parser.add_argument("--hotword-file", type=Path, default=None)
    parser.add_argument("--port", type=int, default=0)
    args = parser.parse_args()
    transcriber = Transcriber(args.model_dir, args.punc_model, args.hotword_file)
    Handler.transcriber = transcriber
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"READY {server.server_port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR {exc}", file=sys.stderr, flush=True)
        raise
