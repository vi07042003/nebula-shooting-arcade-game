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
    def chat(self, history: list, user_message: str, context: str = "") -> str:
        # Inject context invisibly
        query = f"[System Context: {context}]\n\n{user_message}" if context else user_message

        # Convert DB history format [{"role": "user", "content": "..."}, ...]
        reply = None
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
            except Exception as e:
                print(f"Gemini error: {e} — falling back to Pollinations.")
        
        # Fall through to Pollinations
        if not reply:
            reply = self._call_pollinations(history, query)

        return reply

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
