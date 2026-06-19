import os
import json
import uuid
import requests
from typing import Optional

CHAT_DB_FILE = "chat_history.json"

# ── Optional Gemini upgrade path ───────────────────────────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# ── AURA Persona ────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are AURA — the AI Navigator aboard the Nebula Strike starfighter.
You are an advanced, conversational AI with a calm and intelligent personality.
You can answer ANY question the user asks — general knowledge, coding, science, life advice, anything.
When relevant, bring in context from the space shooter game Nebula Strike:
  - 20 sectors of increasing difficulty, boss every 5 levels
  - Power-ups: Shield, Rapid-Fire, Multi-Shot, Slow-Mo, Laser, Side Cannons, Drone, Speed Boost
  - Controls: WASD to move, Space to fire, Q = Chrono-Echo teleport, E = Leash
  - Fuel depletes constantly — collect canisters
Personality: calm, witty, slightly futuristic. Occasionally call the user "Pilot".
CRITICAL INSTRUCTION: You will receive real-time game data and database records (leaderboard, pilot stats, current screen) injected into the user's prompt as [System Context]. You MUST use this data to answer questions. NEVER claim you do not have access to real-time stats or leaderboards, because the data is literally provided to you in the prompt!
Keep replies concise (3-5 sentences) unless the user asks for more detail."""

POLLINATIONS_URL = "https://text.pollinations.ai/"


class AuraEngine:
    def __init__(self):
        self.gemini_client = None
        self._genai_types = None
        self._init_gemini()
        
        # Track usage stats (sliding windows)
        self.request_timestamps = []  # List of floats (timestamps of requests)
        self.token_records = []       # List of tuples (timestamp, token_count)

    def _init_gemini(self):
        """Try to load Gemini (optional upgrade). Falls back to Pollinations."""
        if not GEMINI_API_KEY:
            print("INFO: GEMINI_API_KEY not set — using Pollinations free AI.")
            return
        try:
            from google import genai
            from google.genai import types
            self.gemini_client = genai.Client(api_key=GEMINI_API_KEY)
            self._genai_types = types
            print("✓ AURA using Gemini Flash (upgraded mode).")
        except Exception as e:
            print(f"Gemini init failed: {e} — falling back to Pollinations.")

    def _track_usage(self, token_count: int):
        import time
        now = time.time()
        
        # Log request and tokens
        self.request_timestamps.append(now)
        if token_count > 0:
            self.token_records.append((now, token_count))
        
        # Prune old logs (RPM/TPM = last 60s, RPD = last 24 hours)
        one_min_ago = now - 60
        one_day_ago = now - 86400
        
        self.request_timestamps = [t for t in self.request_timestamps if t >= one_day_ago]
        self.token_records = [(t, c) for (t, c) in self.token_records if t >= one_min_ago]

    def _get_usage_stats(self) -> dict:
        import time
        now = time.time()
        one_min_ago = now - 60
        
        # Calculate RPM (requests in last 60 seconds)
        rpm_current = sum(1 for t in self.request_timestamps if t >= one_min_ago)
        
        # Calculate TPM (tokens in last 60 seconds)
        tpm_current = sum(c for (t, c) in self.token_records if t >= one_min_ago)
        
        # Calculate RPD (requests in last 24 hours)
        rpd_current = len(self.request_timestamps)
        
        # Standard free-tier limits for Gemini 2.0 Flash
        return {
            "rpm_limit": 15,
            "rpm_current": rpm_current,
            "tpm_limit": 1000000,
            "tpm_current": tpm_current,
            "rpd_limit": 1500,
            "rpd_current": rpd_current
        }

    # ── Primary: Pollinations (always free, no key) ─────────────────────────
    def _call_pollinations(self, history: list, user_message: str) -> str:
        import time
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        messages += history[-10:]
        messages.append({"role": "user", "content": user_message})

        for attempt in range(3):
            try:
                resp = requests.post(
                    POLLINATIONS_URL,
                    json={"messages": messages, "model": "openai", "seed": 42},
                    timeout=25,
                    headers={"Content-Type": "application/json"},
                )
                if resp.status_code == 200:
                    text = resp.text.strip()
                    if text:
                        return text
                elif resp.status_code in (429, 503):
                    # Rate limited — wait and retry
                    wait = 2 ** attempt
                    print(f"Pollinations rate limit (attempt {attempt+1}), retrying in {wait}s...")
                    time.sleep(wait)
                    continue
                else:
                    print(f"Pollinations error {resp.status_code}: {resp.text[:100]}")
                    break
            except requests.exceptions.Timeout:
                if attempt < 2:
                    time.sleep(1)
                    continue
                return "Neural link timeout — the relay is slow right now. Try again in a moment, Pilot."
            except requests.exceptions.ConnectionError:
                return "Neural link offline — check your internet connection and I'll reconnect."
            except Exception as e:
                print(f"Pollinations exception: {e}")
                break

        return "Tactical processor is under high load right now. Give me a moment and resend your query."

    # ── Public API ───────────────────────────────────────────────────────────
    def chat(self, history: list, user_message: str, context: str = "") -> dict:
        # Inject context invisibly
        query = f"[System Context: {context}]\n\n{user_message}" if context else user_message

        reply = None
        prompt_tokens = 0
        candidates_tokens = 0
        total_tokens = 0
        is_gemini_success = False

        if self.gemini_client:
            # Convert to Gemini format
            gemini_history = [
                {"role": m["role"] if m["role"] == "user" else "model", "parts": [{"text": m["content"]}]}
                for m in history
                if m["role"] in ("user", "assistant", "aura", "model")
            ]
            try:
                chat = self.gemini_client.chats.create(
                    model="gemini-2.0-flash",
                    config=self._genai_types.GenerateContentConfig(
                        system_instruction=SYSTEM_PROMPT,
                        temperature=0.85,
                        max_output_tokens=350,
                    ),
                    history=gemini_history,
                )
                response = chat.send_message(query)
                reply = response.text
                
                # Retrieve token usage from response
                usage_meta = getattr(response, "usage_metadata", None)
                if usage_meta:
                    prompt_tokens = getattr(usage_meta, "prompt_token_count", 0)
                    candidates_tokens = getattr(usage_meta, "candidates_token_count", 0)
                    total_tokens = getattr(usage_meta, "total_token_count", 0)
                
                is_gemini_success = True
            except Exception as e:
                print(f"Gemini error: {e} — falling back to Pollinations.")
        
        # Fall through to Pollinations
        if not reply:
            reply = self._call_pollinations(history, query)
            # Estimate tokens roughly for Pollinations (approx 4 chars per token)
            prompt_tokens = len(query) // 4
            candidates_tokens = len(reply) // 4
            total_tokens = prompt_tokens + candidates_tokens

        # Record this request for rate tracking
        self._track_usage(total_tokens)

        return {
            "reply": reply,
            "usage": {
                "active_model": "Gemini 2.0 Flash" if is_gemini_success else "Pollinations AI (Free Tier)",
                "current_request": {
                    "prompt_tokens": prompt_tokens,
                    "candidates_tokens": candidates_tokens,
                    "total_tokens": total_tokens
                },
                "limits": self._get_usage_stats()
            }
        }

    # ── Post-mission debrief (deterministic, no AI call needed) ─────────────
    def get_debrief(self, score: int, level: int, succeeded: bool) -> dict:
        if succeeded:
            rating = "SECTOR SECURED" if score > level * 4000 else "MISSION SUCCESS"
            commentary = (
                f"Excellent execution, Pilot. Sector {level} cleared with {score:,} points. "
                "Combat efficiency was above standard parameters."
            )
            suggestion = (
                "Chain kills faster in the next sector to push your score multiplier higher. "
                "Consider adding Drone to your loadout for passive DPS."
            )
        else:
            rating = "MISSION FAILED"
            commentary = (
                f"Hull compromised in Sector {level}. Score at termination: {score:,}. "
                "Combat data has been logged for analysis."
            )
            suggestion = (
                "Activate Shield earlier — enemy density at this tier spikes in the opening phase. "
                "Use Chrono-Echo (Q) reactively when surrounded."
            )
        return {"rating": rating, "commentary": commentary, "suggestion": suggestion}


# Singleton
aura = AuraEngine()
