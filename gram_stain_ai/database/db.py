import os
import sqlite3
from flask import g

# Database file path
DATABASE = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'gram_stain.db')

def get_db():
    """Connect to the database and return a connection object"""
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row  # This enables column access by name
    return db

def init_db():
    """Initialize the database with the required tables"""
    # Ensure the database directory exists
    os.makedirs(os.path.dirname(DATABASE), exist_ok=True)
    
    print(f"Initializing database at {DATABASE}")
    
    with sqlite3.connect(DATABASE) as conn:
        cursor = conn.cursor()
        
        # Create slides table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS slides (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_slide TEXT UNIQUE NOT NULL,
            name_patient TEXT NOT NULL,
            date_created TIMESTAMP NOT NULL
        )
        ''')
        
        # Create images table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            upload_time TIMESTAMP NOT NULL,
            slide_id INTEGER,
            FOREIGN KEY (slide_id) REFERENCES slides (id)
        )
        ''')
        
        # Create results table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            image_id INTEGER NOT NULL,
            gram_type TEXT NOT NULL,
            confidence REAL NOT NULL,
            processing_time TIMESTAMP NOT NULL,
            FOREIGN KEY (image_id) REFERENCES images (id)
        )
        ''')
        
        conn.commit()
        print("Database initialized successfully")