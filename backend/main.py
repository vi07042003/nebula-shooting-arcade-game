from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel, ConfigDict
from typing import List
import json
import os
import datetime
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import SessionLocal, ScoreEntry, init_db, get_db

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
