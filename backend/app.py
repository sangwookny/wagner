from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
import os

from models.book import db, Book, Page, TranslationHistory
from routes.ocr import ocr_bp
from routes.book import book_bp

load_dotenv()

app = Flask(__name__)
CORS(app)

basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{basedir}/wagner.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
if not OPENAI_API_KEY:
    print("Warning: OPENAI_API_KEY not found")

app.register_blueprint(ocr_bp, url_prefix='/api')
app.register_blueprint(book_bp, url_prefix='/api')

@app.route('/')
def home():
    return {
        "message": "Wagner Translator Backend API",
        "status": "running",
        "version": "2.0.0",
        "database": "SQLite"
    }

@app.route('/health')
def health():
    return {"status": "healthy"}

with app.app_context():
    db.create_all()
    print("Database tables created!")

if __name__ == '__main__':
    print("Starting Wagner Backend Server...")
    app.run(debug=True, port=5000)