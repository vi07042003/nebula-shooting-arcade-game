from sqlalchemy import Column, Integer, String, DateTime, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
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

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
