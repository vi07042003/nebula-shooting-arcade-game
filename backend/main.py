from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel, ConfigDict
from typing import List
import json
import os
import uuid
import datetime
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import SessionLocal, ScoreEntry, ChatSession, ChatMessageEntry, init_db, get_db
from aura_engine import aura

# Initialize database tables
init_db()

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Score(BaseModel):
    pilot_id: str
    username: str
    score: int

class UpdateUsername(BaseModel):
    pilot_id: str
    username: str

    model_config = ConfigDict(from_attributes=True)

class ChatMessage(BaseModel):
    pilot_id: str
    session_id: str
    message: str
    game_state: str = ""
    current_level: int = 1
    unlocked_levels: int = 1
    powerups: list[str] = []

class NewChatRequest(BaseModel):
    pilot_id: str

class GameState(BaseModel):
    level: int
    health: int
    fuel: int
    score: int
    enemies_count: int = 0
    boss_active: bool = False

class DebriefRequest(BaseModel):
    score: int
    level: int
    succeeded: bool

# Migration logic: if scores.json exists, move data to DB and rename the file
def migrate_json_to_db():
    DB_FILE = "scores.json"
    if os.path.exists(DB_FILE):
        db = SessionLocal()
        try:
            with open(DB_FILE, "r") as f:
                scores = json.load(f)
                for s in scores:
                    db_score = ScoreEntry(username=s["username"], score=s["score"])
                    db.add(db_score)
                db.commit()
            os.rename(DB_FILE, "scores.json.bak")
            print("Successfully migrated scores.json to PostgreSQL")
        except Exception as e:
            print(f"Migration failed: {e}")
            db.rollback()
        finally:
            db.close()

# Run migration on startup
migrate_json_to_db()

@app.get("/leaderboard", response_model=List[Score])
async def get_leaderboard(db: Session = Depends(get_db)):
    scores = db.query(ScoreEntry).order_by(ScoreEntry.score.desc()).limit(10).all()
    return scores

@app.post("/update-username")
async def update_username(data: UpdateUsername, db: Session = Depends(get_db)):
    db_score = db.query(ScoreEntry).filter(ScoreEntry.pilot_id == data.pilot_id).first()
    if db_score:
        db_score.username = data.username
        db.commit()
        return {"message": "Username updated successfully"}
    return {"message": "User not found in records"}

@app.post("/score")
async def post_score(score: Score, db: Session = Depends(get_db)):
    # Find record by unique pilot_id
    db_score = db.query(ScoreEntry).filter(ScoreEntry.pilot_id == score.pilot_id).first()
    
    if db_score:
        # Update existing record (handle renaming and latest score)
        db_score.username = score.username
        db_score.score = score.score
        db_score.created_at = datetime.datetime.utcnow()
    else:
        # Create new record
        db_score = ScoreEntry(pilot_id=score.pilot_id, username=score.username, score=score.score)
        db.add(db_score)
        
    db.commit()
    return {"message": "Score saved successfully"}

@app.post("/ai/chat")
async def ai_chat(msg: ChatMessage, db: Session = Depends(get_db)):
    """AURA conversational AI - powered by Gemini Flash or Pollinations"""
    if not msg.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
        
    # Get or create session
    chat_session = db.query(ChatSession).filter(ChatSession.id == msg.session_id).first()
    if not chat_session:
        # Create session if it doesn't exist
        chat_session = ChatSession(id=msg.session_id, pilot_id=msg.pilot_id, title="New Tactical Session")
        db.add(chat_session)
        db.commit()
        db.refresh(chat_session)
        
    # Get history
    history_entries = db.query(ChatMessageEntry).filter(ChatMessageEntry.session_id == msg.session_id).order_by(ChatMessageEntry.created_at.asc()).all()
    history = [{"role": e.role, "content": e.content} for e in history_entries]
    
    # Auto-title on first message
    if len(history) == 0:
        words = msg.message.split()
        chat_session.title = " ".join(words[:4]) + ("..." if len(words) > 4 else "")
        db.commit()
        
    # Save user message
    user_msg = ChatMessageEntry(session_id=msg.session_id, role="user", content=msg.message)
    db.add(user_msg)
    db.commit()
    
    # Fetch pilot's full db record for context
    pilot_entry = db.query(ScoreEntry).filter(ScoreEntry.pilot_id == msg.pilot_id).first()
    
    # Fetch top 3 leaderboard to give AURA global context
    top_scores = db.query(ScoreEntry).order_by(ScoreEntry.score.desc()).limit(3).all()
    leaderboard_text = ", ".join([f"#{i+1} {s.username} ({s.score} pts)" for i, s in enumerate(top_scores)])

    pilot_username = pilot_entry.username if pilot_entry else "Unknown Pilot"
    pilot_high_score = pilot_entry.score if pilot_entry else 0
    pilot_joined = pilot_entry.created_at.strftime("%Y-%m-%d") if pilot_entry else "Unknown"

    context = (
        f"Database ID (Pilot_ID): {msg.pilot_id}\n"
        f"Database Username: {pilot_username}\n"
        f"Database High Score: {pilot_high_score}\n"
        f"Database Account Created: {pilot_joined}\n"
        f"Global Leaderboard (Top 3): {leaderboard_text}\n"
        f"Current Screen: {msg.game_state}\n"
        f"Selected/Current Level: {msg.current_level}\n"
        f"Max Unlocked Sector: {msg.unlocked_levels}\n"
        f"Active Power-up Loadout: {', '.join(msg.powerups) if msg.powerups else 'None'}"
    )

    # Get AI response
    chat_result = aura.chat(history, msg.message, context)
    reply = chat_result["reply"]
    usage = chat_result["usage"]
    
    # Save AI response
    ai_msg = ChatMessageEntry(session_id=msg.session_id, role="assistant", content=reply)
    db.add(ai_msg)
    db.commit()
    
    return {"reply": reply, "usage": usage}

@app.get("/ai/usage")
async def get_ai_usage():
    """Retrieve current Gemini API usage limits and statistics"""
    return {
        "active_model": "Gemini 2.0 Flash" if aura.gemini_client else "Pollinations AI (Free Tier)",
        "limits": aura._get_usage_stats()
    }


@app.get("/ai/sessions/{pilot_id}")
async def get_sessions(pilot_id: str, db: Session = Depends(get_db)):
    """List all chat sessions for a pilot"""
    sessions = db.query(ChatSession).filter(ChatSession.pilot_id == pilot_id).order_by(ChatSession.created_at.desc()).all()
    return {"sessions": [{"session_id": s.id, "title": s.title} for s in sessions]}

@app.get("/ai/chat/{session_id}")
async def get_chat_history(session_id: str, db: Session = Depends(get_db)):
    """Get message history for a specific chat session"""
    entries = db.query(ChatMessageEntry).filter(ChatMessageEntry.session_id == session_id).order_by(ChatMessageEntry.created_at.asc()).all()
    return {"messages": [{"role": e.role, "content": e.content} for e in entries]}

@app.post("/ai/chat/new")
async def new_chat(req: NewChatRequest, db: Session = Depends(get_db)):
    """Create a new chat session"""
    sid = str(uuid.uuid4())
    chat_session = ChatSession(id=sid, pilot_id=req.pilot_id, title="New Tactical Session")
    db.add(chat_session)
    
    # Add initial greeting message
    initial_msg = ChatMessageEntry(
        session_id=sid,
        role="assistant",
        content="Neural link established. I'm AURA, your onboard AI Navigator. How can I assist you today—whether it's tactics, score analysis, or a quick briefing?"
    )
    db.add(initial_msg)
    db.commit()
    return {"session_id": sid}

@app.delete("/ai/chat/{session_id}")
async def delete_chat(session_id: str, db: Session = Depends(get_db)):
    """Delete a chat session"""
    chat_session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if chat_session:
        db.delete(chat_session)
        db.commit()
    return {"message": "Chat deleted"}

@app.post("/ai/debrief")
async def ai_debrief(req: DebriefRequest):
    """Post-mission AURA analysis"""
    return aura.get_debrief(req.score, req.level, req.succeeded)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
