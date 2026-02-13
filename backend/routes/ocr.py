from flask import Blueprint, request, jsonify
from services.openai_service import (
    extract_text_from_image,
    translate_with_sentence_mapping,
    merge_and_translate_pages
)
import base64

ocr_bp = Blueprint('ocr', __name__)

@ocr_bp.route('/ocr', methods=['POST'])
def ocr():
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400

        image_file = request.files['image']
        previous_german = request.form.get('previous_german', '')

        image_data = image_file.read()
        base64_image = base64.b64encode(image_data).decode('utf-8')

        print("📸 Processing image...")
        print("🔍 Extracting German text...")
        german_text = extract_text_from_image(base64_image)
        print(f"   OCR result (first 80): {german_text[:80]}...")

        if previous_german:
            # 이전 페이지가 있으면 → 합치기 + 번역 한번에
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

            print("✅ All processing complete!")

            return jsonify({
                'success': True,
                'original': clean_german,
                'korean': korean_text,
                'english': english_text,
                'sentences': sentences,
                'filename': image_file.filename,
                'merged_from_previous': merged_from
            })

        else:
            # 첫 페이지 → 그냥 번역
            print("🔄 Translating with sentence mapping...")
            sentences = translate_with_sentence_mapping(german_text)

            korean_text = '\n'.join([s['ko'] for s in sentences])
            english_text = '\n'.join([s['en'] for s in sentences])

            print("✅ All processing complete!")

            return jsonify({
                'success': True,
                'original': german_text,
                'korean': korean_text,
                'english': english_text,
                'sentences': sentences,
                'filename': image_file.filename
            })

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'error': str(e)}), 500