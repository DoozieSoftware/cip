"""
Modal app: CIP Vision (transformers serving Qwen2.5-VL-7B-Instruct)

Re-deploys the Civic Intelligence Platform's AI vision endpoint on Modal
with a vision-language model (Qwen/Qwen2.5-VL-7B-Instruct) so the AI
pipeline can classify photos and perform ANPR (license plate extraction).

Uses transformers directly (not vLLM) to avoid version conflicts.
Exposes an OpenAI-compatible /v1/chat/completions endpoint that the
backend's OpenAICompatibleProvider can call unchanged.

Deploy:
    modal deploy scripts/modal_vision_vllm.py

Endpoint URL:
    https://akshayjoshi999--cip-vision-v3-serve.modal.run

After deploying, update backend/.env.cpanel and backend/.env:
    AI_MODAL_BASE_URL=https://akshayjoshi999--cip-vision-v3-serve.modal.run
    AI_MODAL_MODEL=Qwen/Qwen2.5-VL-7B-Instruct
"""

import modal

APP_NAME = "cip-vision-v3"
MODEL_ID = "Qwen/Qwen2.5-VL-7B-Instruct"
GPU_TYPE = "A10G"
MAX_IMAGE_SIZE = 1024  # max dimension for resizing images
SERVICE_VERSION = "2026-07-14-vision-receipt-v1"


def _download_model():
    from huggingface_hub import snapshot_download

    snapshot_download(MODEL_ID)


image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "ffmpeg", "libgl1")
    .pip_install(
        "torch==2.5.1",
        "torchvision==0.20.1",
        "transformers==4.49.0",
        "accelerate>=0.34.0",
        "qwen-vl-utils==0.0.11",
        "Pillow>=10.0.0",
        "httpx",
        "starlette",
    )
    .run_function(_download_model, timeout=60 * 30)
)

app = modal.App(APP_NAME, image=image)


@app.function(
    gpu=f"{GPU_TYPE}:1",
    cpu=4,
    memory=16384,
    timeout=60 * 60,
    scaledown_window=300,
    min_containers=0,
)
@modal.concurrent(max_inputs=2)
@modal.asgi_app()
def serve():
    import asyncio
    import base64
    import json
    import re
    import time
    from io import BytesIO

    import httpx
    import torch
    from PIL import Image
    from qwen_vl_utils import process_vision_info
    from transformers import AutoProcessor, Qwen2_5_VLForConditionalGeneration

    # Load model
    model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
        MODEL_ID,
        torch_dtype=torch.float16,
        device_map="auto",
    )
    model.eval()
    processor = AutoProcessor.from_pretrained(MODEL_ID)

    # Global lock for inference (single GPU, serial requests)
    infer_lock = asyncio.Event()
    infer_lock.set()

    async def chat_completions(receive, send):
        """Handle POST /v1/chat/completions"""
        # Read body
        body = b""
        more_body = True
        while more_body:
            message = await receive()
            body += message.get("body", b"")
            more_body = message.get("more_body", False)

        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            await _json_response(send, 400, {"error": "Invalid JSON"})
            return

        messages = data.get("messages", [])
        max_tokens = data.get("max_tokens", 1024)
        temperature = data.get("temperature", 0.1)

        # Convert OpenAI messages to Qwen-VL format
        qwen_messages = []
        images = []
        requested_images = 0

        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content")

            if isinstance(content, str):
                qwen_messages.append({"role": role, "content": content})
            elif isinstance(content, list):
                qwen_content = []
                for part in content:
                    if part.get("type") == "text":
                        qwen_content.append({"type": "text", "text": part["text"]})
                    elif part.get("type") == "image_url":
                        requested_images += 1
                        url = part["image_url"]["url"]
                        try:
                            if url.startswith("data:"):
                                match = re.fullmatch(
                                    r"data:image/[^;]+;base64,(.+)", url, re.DOTALL
                                )
                                if not match:
                                    raise ValueError("Malformed image data URI")
                                img_bytes = base64.b64decode(
                                    match.group(1), validate=True
                                )
                            else:
                                async with httpx.AsyncClient(
                                    follow_redirects=True, timeout=30
                                ) as client:
                                    image_response = await client.get(url)
                                    image_response.raise_for_status()
                                    img_bytes = image_response.content

                            img = Image.open(BytesIO(img_bytes)).convert("RGB")
                            w, h = img.size
                            if max(w, h) > MAX_IMAGE_SIZE:
                                scale = MAX_IMAGE_SIZE / max(w, h)
                                img = img.resize(
                                    (int(w * scale), int(h * scale)),
                                    Image.Resampling.LANCZOS,
                                )
                            images.append(img)
                            qwen_content.append({"type": "image", "image": img})
                        except Exception as exc:
                            await _json_response(
                                send,
                                422,
                                {
                                    "error": {
                                        "message": f"Unable to decode image input: {exc}",
                                        "type": "invalid_image",
                                    }
                                },
                            )
                            return
                qwen_messages.append({"role": role, "content": qwen_content})

        if requested_images > 0 and len(images) != requested_images:
            await _json_response(
                send,
                422,
                {
                    "error": {
                        "message": "Not all requested images were decoded",
                        "type": "invalid_image",
                    }
                },
            )
            return

        # Prepare inputs
        text = processor.apply_chat_template(
            qwen_messages, tokenize=False, add_generation_prompt=True
        )
        image_inputs, video_inputs = process_vision_info(qwen_messages)

        inputs = processor(
            text=[text],
            images=image_inputs,
            videos=video_inputs,
            padding=True,
            return_tensors="pt",
        ).to(model.device)

        # Run inference in thread to not block event loop
        loop = asyncio.get_event_loop()

        def _generate():
            with torch.no_grad():
                output_ids = model.generate(
                    **inputs,
                    max_new_tokens=max_tokens,
                    temperature=temperature,
                    do_sample=temperature > 0,
                )

            # Strip input tokens
            input_len = inputs["input_ids"].shape[1]
            generated = output_ids[:, input_len:]
            return processor.batch_decode(
                generated, skip_special_tokens=True
            )[0]

        try:
            # Serialize inference
            await infer_lock.wait()
            infer_lock.clear()
            try:
                text_out = await loop.run_in_executor(None, _generate)
            finally:
                infer_lock.set()
        except Exception as e:
            await _json_response(
                send, 500, {"error": {"message": str(e), "type": "internal_error"}}
            )
            return

        # Build OpenAI-format response
        response = {
            "id": f"chatcmpl-{int(time.time()*1000)}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": MODEL_ID,
            "service_version": SERVICE_VERSION,
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": text_out},
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "prompt_tokens": inputs["input_ids"].shape[1],
                "completion_tokens": len(text_out),
                "total_tokens": inputs["input_ids"].shape[1] + len(text_out),
                "image_count": len(images),
                "image_sizes": [list(img.size) for img in images],
            },
        }

        await _json_response(send, 200, response)

    async def models_list(receive, send):
        """Handle GET /v1/models"""
        await _json_response(
            send,
            200,
            {
                "object": "list",
                "data": [
                    {
                        "id": MODEL_ID,
                        "object": "model",
                        "created": 0,
                        "owned_by": "qwen",
                    }
                ],
            },
        )

    async def health(receive, send):
        await _json_response(
            send,
            200,
            {"status": "ok", "service_version": SERVICE_VERSION},
        )

    async def app_handler(scope, receive, send):
        if scope["type"] != "http":
            return

        path = scope["path"].rstrip("/")
        method = scope["method"]

        if path in ("", "/health", "/healthz"):
            await health(receive, send)
        elif path == "/v1/models" and method == "GET":
            await models_list(receive, send)
        elif path == "/v1/chat/completions" and method == "POST":
            await chat_completions(receive, send)
        else:
            await _json_response(
                send, 404, {"error": {"message": "Not found", "type": "not_found"}}
            )

    async def _json_response(send, status, data):
        body = json.dumps(data).encode()
        await send(
            {
                "type": "http.response.start",
                "status": status,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode()),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})

    return app_handler
