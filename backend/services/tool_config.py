"""Tool configuration — each NLP tool can be enabled/disabled by admin."""
import json
import os

CONFIG_FILE = os.path.join(os.path.dirname(__file__), "..", "tool_config.json")

DEFAULT_CONFIG = {
    "tools": {
        "tokenization":      {"enabled": True, "description": "Split text into tokens"},
        "pos_tagging":       {"enabled": True, "description": "Part-of-speech tagging"},
        "lemmatization":     {"enabled": True, "description": "Reduce words to base form"},
        "sentiment":         {"enabled": True, "description": "Sentiment analysis"},
        "ner":               {"enabled": True, "description": "Named entity recognition"},
        "classification":    {"enabled": True, "description": "Text topic classification"},
        "language_detection":{"enabled": True, "description": "Auto-detect document language"},
        "url_image_ocr":     {"enabled": True, "description": "OCR images found in URL pages"},
    }
}


def load_config() -> dict:
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
            config = dict(DEFAULT_CONFIG)
            config["tools"].update(saved.get("tools", {}))
            return config
        except Exception as e:
            print(f"[ToolConfig] Failed to load: {e}", flush=True)
    return DEFAULT_CONFIG


def save_config(config: dict) -> None:
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"[ToolConfig] Failed to save: {e}", flush=True)


def is_enabled(tool_name: str) -> bool:
    return load_config()["tools"].get(tool_name, {}).get("enabled", True)


def get_all_tools() -> dict:
    return load_config()["tools"]


def update_tool(tool_name: str, enabled: bool) -> dict:
    config = load_config()
    if tool_name in config["tools"]:
        config["tools"][tool_name]["enabled"] = enabled
        save_config(config)
    return config["tools"]