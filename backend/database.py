from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, create_engine, Text
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
import datetime

# PostgreSQL connection URL
# Use empty host to connect via unix socket (Peer authentication)
SQLALCHEMY_DATABASE_URL = "postgresql:///shooting_game"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class ScoreEntry(Base):
    __tablename__ = "scores"

    id = Column(Integer, primary_key=True, index=True)
    pilot_id = Column(String, unique=True, index=True)
    username = Column(String, index=True)
    score = Column(Integer)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True, index=True)
    pilot_id = Column(String, index=True)
    title = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    messages = relationship("ChatMessageEntry", back_populates="session", cascade="all, delete-orphan")

class ChatMessageEntry(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("chat_sessions.id", ondelete="CASCADE"), index=True)
    role = Column(String) # 'user' or 'assistant' or 'aura'
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    session = relationship("ChatSession", back_populates="messages")

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
