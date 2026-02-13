from flask import Blueprint, request, jsonify
from services.openai_service import (
    extract_text_from_image,
    translate_with_sentence_mapping,
    merge_and_translate_pages
)
import base64
import os
import uuid
import json
from datetime import datetime
from PIL import Image
import io

ocr_bp = Blueprint('ocr', __name__)

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def crop_image_region(image_data, top_percent, bottom_percent):
    """이미지에서 특정 영역만 크롭"""
    img = Image.open(io.BytesIO(image_data))
    width, height = img.size
    top_px = int(height * top_percent / 100)
    bottom_px = int(height * bottom_percent / 100)
    # 좌우는 약간 여백 줄이기
    left_px = int(width * 0.05)
    right_px = int(width * 0.95)
    cropped = img.crop((left_px, top_px, right_px, bottom_px))

    crop_filename = f"crop_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}.png"
    crop_path = os.path.join(UPLOAD_FOLDER, crop_filename)
    cropped.save(crop_path, 'PNG')
    print(f"   ✂️ Cropped image saved: {crop_filename} (top:{top_percent}% bottom:{bottom_percent}%)")
    return crop_filename


@ocr_bp.route('/ocr', methods=['POST'])
def ocr():
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400

        image_file = request.files['image']
        previous_german = request.form.get('previous_german', '')

        image_data = image_file.read()
        base64_image = base64.b64encode(image_data).decode('utf-8')

        # 원본 이미지 저장
        ext = image_file.filename.rsplit('.', 1)[-1] if '.' in image_file.filename else 'jpg'
        filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}.{ext}"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        with open(filepath, 'wb') as f:
            f.write(image_data)
        print(f"💾 Image saved: {filename}")

        print("📸 Processing image...")
        print("🔍 Analyzing page content...")
        page_analysis = extract_text_from_image(base64_image)

        has_music = page_analysis.get('has_music_score', False)
        has_illustration = page_analysis.get('has_illustration', False)
        content_blocks = page_analysis.get('content_blocks', [])
        german_text = page_analysis.get('full_text', '')

        if has_music:
            print("🎵 Music score detected!")
        if has_illustration:
            print("🖼️ Illustration detected!")

        # 악보/그림 크롭
        for block in content_blocks:
            if block['type'] in ['music_score', 'illustration']:
                crop_info = block.get('crop_percent', None)
                if crop_info:
                    top = crop_info.get('top', 0)
                    bottom = crop_info.get('bottom', 100)
                    print(f"   📐 AI crop_percent: top={top}, bottom={bottom}")
                    # AI가 위치를 약간 아래로 잡는 경향 보정
                    top = max(0, top - 12)
                    bottom = max(top + 5, bottom - 12)
                    print(f"   📐 Adjusted: top={top}, bottom={bottom}")
                    crop_file = crop_image_region(image_data, top, bottom)
                    block['image_file'] = crop_file
                else:
                    block['image_file'] = filename

        print(f"   Text (first 80): {german_text[:80]}...")
        print(f"   Content blocks: {len(content_blocks)}")

        # 페이지 타입 결정
        if has_music:
            page_type = 'music'
        elif has_illustration:
            page_type = 'illustration'
        else:
            page_type = 'text'

        if previous_german:
            prev_ending = previous_german[-300:] if len(previous_german) > 300 else previous_german
            print(f"🔗 Previous page ending: ...{prev_ending[-60:]}")
            print("🔄 Merge and translate...")

            result = merge_and_translate_pages(prev_ending, german_text)

            sentences = result.get('sentences', [])
            clean_german = result.get('clean_german', german_text)
            merged_from = result.get('merged_from_previous', '')

            if merged_from:
                print(f"   ✨ Merged from previous: {merged_from}")

            korean_text = '\n'.join([s['ko'] for s in sentences])
            english_text = '\n'.join([s['en'] for s in sentences])

        else:
            print("🔄 Translating with sentence mapping...")
            sentences = translate_with_sentence_mapping(german_text)

            korean_text = '\n'.join([s['ko'] for s in sentences])
            english_text = '\n'.join([s['en'] for s in sentences])
            clean_german = german_text
            merged_from = ''

        print("✅ All processing complete!")

        return jsonify({
            'success': True,
            'original': clean_german,
            'korean': korean_text,
            'english': english_text,
            'sentences': sentences,
            'content_blocks': content_blocks,
            'page_type': page_type,
            'has_music_score': has_music,
            'has_illustration': has_illustration,
            'filename': image_file.filename,
            'saved_image': filename,
            'merged_from_previous': merged_from
        })

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@ocr_bp.route('/uploads/<filename>', methods=['GET'])
def serve_upload(filename):
    from flask import send_from_directory
    return send_from_directory(UPLOAD_FOLDER, filename)