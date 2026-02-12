from flask import Blueprint, request, jsonify
from services.openai_service import extract_text_from_image
import base64

ocr_bp = Blueprint('ocr', __name__)

@ocr_bp.route('/ocr', methods=['POST'])
def ocr():
    """이미지에서 독일어 텍스트 추출"""
    try:
        # 이미지 받기
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400
        
        image_file = request.files['image']
        
        # 이미지를 base64로 변환
        image_data = image_file.read()
        base64_image = base64.b64encode(image_data).decode('utf-8')
        
        # OpenAI로 OCR 처리
        extracted_text = extract_text_from_image(base64_image)
        
        return jsonify({
            'success': True,
            'text': extracted_text,
            'filename': image_file.filename
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500