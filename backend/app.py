from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os

# 라우트 import
from routes.ocr import ocr_bp

# 환경 변수 로드
load_dotenv()

app = Flask(__name__)
CORS(app)

# OpenAI API 키 확인
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
if not OPENAI_API_KEY:
    print("⚠️ Warning: OPENAI_API_KEY not found in .env file")

# 라우트 등록
app.register_blueprint(ocr_bp, url_prefix='/api')

@app.route('/')
def home():
    return jsonify({
        "message": "Wagner Translator Backend API",
        "status": "running",
        "version": "1.0.0",
        "endpoints": {
            "/api/ocr": "POST - Extract text from image"
        }
    })

@app.route('/health')
def health():
    return jsonify({"status": "healthy"})

if __name__ == '__main__':
    print("🚀 Starting Wagner Backend Server...")
    print(f"📁 Working directory: {os.getcwd()}")
    app.run(debug=True, port=5000)