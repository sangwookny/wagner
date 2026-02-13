from flask import Blueprint, request, jsonify
from models.book import db, Book, Page, TranslationHistory
import json

book_bp = Blueprint('book', __name__)

@book_bp.route('/books', methods=['GET'])
def get_books():
    books = Book.query.all()
    return jsonify({
        'success': True,
        'books': [book.to_dict() for book in books]
    })

@book_bp.route('/books', methods=['POST'])
def create_book():
    data = request.json
    book = Book(
        title=data.get('title', 'Untitled'),
        author=data.get('author', ''),
        original_language=data.get('original_language', 'german')
    )
    db.session.add(book)
    db.session.commit()
    return jsonify({
        'success': True,
        'book': book.to_dict()
    }), 201

@book_bp.route('/books/<int:book_id>', methods=['GET'])
def get_book(book_id):
    book = Book.query.get_or_404(book_id)
    return jsonify({
        'success': True,
        'book': book.to_dict()
    })

@book_bp.route('/books/<int:book_id>/pages', methods=['GET'])
def get_book_pages(book_id):
    book = Book.query.get_or_404(book_id)
    pages = Page.query.filter_by(book_id=book_id).order_by(Page.page_number).all()
    return jsonify({
        'success': True,
        'book_id': book_id,
        'title': book.title,
        'pages': [page.to_dict() for page in pages]
    })

@book_bp.route('/books/<int:book_id>/pages', methods=['POST'])
def add_page(book_id):
    book = Book.query.get_or_404(book_id)
    data = request.json
    last_page = Page.query.filter_by(book_id=book_id).order_by(Page.page_number.desc()).first()
    next_page_number = (last_page.page_number + 1) if last_page else 1

    sentences_data = data.get('sentences', None)
    sentences_str = json.dumps(sentences_data, ensure_ascii=False) if sentences_data else None

    page = Page(
        book_id=book_id,
        page_number=next_page_number,
        page_type=data.get('page_type', 'text'),
        german_text=data.get('german_text', ''),
        korean_text=data.get('korean_text', ''),
        english_text=data.get('english_text', ''),
        sentences_json=sentences_str,
        original_image_url=data.get('original_image_url', ''),
        content_images=data.get('content_images', '')
    )
    db.session.add(page)

    if data.get('korean_text'):
        db.session.add(TranslationHistory(
            page=page, field='korean_text',
            translation_text=data.get('korean_text'),
            version_number=1, is_active=True
        ))
    if data.get('english_text'):
        db.session.add(TranslationHistory(
            page=page, field='english_text',
            translation_text=data.get('english_text'),
            version_number=1, is_active=True
        ))
    db.session.commit()
    return jsonify({
        'success': True,
        'page': page.to_dict()
    }), 201

@book_bp.route('/pages/<int:page_id>', methods=['DELETE'])
def delete_page(page_id):
    page = Page.query.get_or_404(page_id)
    book_id = page.book_id

    db.session.delete(page)

    # 페이지 번호 재정렬
    remaining = Page.query.filter_by(book_id=book_id).order_by(Page.page_number).all()
    for idx, p in enumerate(remaining):
        p.page_number = idx + 1

    db.session.commit()
    return jsonify({'success': True})

@book_bp.route('/pages/<int:page_id>', methods=['PUT'])
def update_page(page_id):
    page = Page.query.get_or_404(page_id)
    data = request.json

    if 'korean_text' in data:
        page.korean_text = data['korean_text']
        # sentences_json에서 한국어도 업데이트
        if page.sentences_json:
            sentences = json.loads(page.sentences_json)
            new_lines = data['korean_text'].split('\n')
            for i, s in enumerate(sentences):
                if i < len(new_lines):
                    s['ko'] = new_lines[i]
            page.sentences_json = json.dumps(sentences, ensure_ascii=False)

    if 'english_text' in data:
        page.english_text = data['english_text']
        if page.sentences_json:
            sentences = json.loads(page.sentences_json)
            new_lines = data['english_text'].split('\n')
            for i, s in enumerate(sentences):
                if i < len(new_lines):
                    s['en'] = new_lines[i]
            page.sentences_json = json.dumps(sentences, ensure_ascii=False)

    if 'german_text' in data:
        page.german_text = data['german_text']
        if page.sentences_json:
            sentences = json.loads(page.sentences_json)
            new_lines = data['german_text'].split('\n')
            for i, s in enumerate(sentences):
                if i < len(new_lines):
                    s['de'] = new_lines[i]
            page.sentences_json = json.dumps(sentences, ensure_ascii=False)

    if 'sentences' in data:
        page.sentences_json = json.dumps(data['sentences'], ensure_ascii=False)

    db.session.commit()
    return jsonify({
        'success': True,
        'page': page.to_dict()
    })

@book_bp.route('/pages/<int:page_id>/move', methods=['POST'])
def move_page(page_id):
    page = Page.query.get_or_404(page_id)
    data = request.json
    direction = data.get('direction')  # 'up' or 'down'

    if direction == 'up' and page.page_number > 1:
        swap = Page.query.filter_by(
            book_id=page.book_id,
            page_number=page.page_number - 1
        ).first()
        if swap:
            swap.page_number, page.page_number = page.page_number, swap.page_number
            db.session.commit()

    elif direction == 'down':
        swap = Page.query.filter_by(
            book_id=page.book_id,
            page_number=page.page_number + 1
        ).first()
        if swap:
            swap.page_number, page.page_number = page.page_number, swap.page_number
            db.session.commit()

    pages = Page.query.filter_by(book_id=page.book_id).order_by(Page.page_number).all()
    return jsonify({
        'success': True,
        'pages': [p.to_dict() for p in pages]
    })

@book_bp.route('/pages/<int:page_id>/retranslate', methods=['POST'])
def retranslate_page(page_id):
    from services.openai_service import translate_with_sentence_mapping
    page = Page.query.get_or_404(page_id)
    data = request.json
    field = data.get('field')
    if field not in ['korean', 'english', 'all']:
        return jsonify({'error': 'Invalid field'}), 400
    try:
        sentences = translate_with_sentence_mapping(page.german_text)

        new_korean = '\n'.join([s['ko'] for s in sentences])
        new_english = '\n'.join([s['en'] for s in sentences])

        page.korean_text = new_korean
        page.english_text = new_english
        page.sentences_json = json.dumps(sentences, ensure_ascii=False)

        last_ko = TranslationHistory.query.filter_by(
            page_id=page_id, field='korean_text'
        ).order_by(TranslationHistory.version_number.desc()).first()
        next_ko_ver = (last_ko.version_number + 1) if last_ko else 1
        TranslationHistory.query.filter_by(
            page_id=page_id, field='korean_text'
        ).update({'is_active': False})
        db.session.add(TranslationHistory(
            page_id=page_id, field='korean_text',
            translation_text=new_korean,
            version_number=next_ko_ver, is_active=True
        ))

        last_en = TranslationHistory.query.filter_by(
            page_id=page_id, field='english_text'
        ).order_by(TranslationHistory.version_number.desc()).first()
        next_en_ver = (last_en.version_number + 1) if last_en else 1
        TranslationHistory.query.filter_by(
            page_id=page_id, field='english_text'
        ).update({'is_active': False})
        db.session.add(TranslationHistory(
            page_id=page_id, field='english_text',
            translation_text=new_english,
            version_number=next_en_ver, is_active=True
        ))

        db.session.commit()
        return jsonify({
            'success': True,
            'page': page.to_dict(),
            'new_version': next_ko_ver
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@book_bp.route('/pages/<int:page_id>/recrop', methods=['POST'])
def recrop_page(page_id):
    page = Page.query.get_or_404(page_id)
    data = request.json
    block_index = data.get('block_index', 0)
    crop_top = data.get('crop_top', 0)
    crop_bottom = data.get('crop_bottom', 100)

    try:
        # content_images에서 해당 블록 업데이트
        blocks = json.loads(page.content_images) if page.content_images else []

        if block_index < len(blocks):
            block = blocks[block_index]
            block['crop_percent'] = {'top': crop_top, 'bottom': crop_bottom}

            # 원본 이미지에서 re-crop
            import os
            from PIL import Image
            import io
            import uuid
            from datetime import datetime

            upload_folder = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads')
            original_path = os.path.join(upload_folder, page.original_image_url)

            if os.path.exists(original_path):
                img = Image.open(original_path)
                width, height = img.size
                top_px = max(0, int(height * crop_top / 100))
                bottom_px = min(height, int(height * crop_bottom / 100))
                left_px = int(width * 0.05)
                right_px = int(width * 0.95)
                cropped = img.crop((left_px, top_px, right_px, bottom_px))

                crop_filename = f"crop_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}.png"
                crop_path = os.path.join(upload_folder, crop_filename)
                cropped.save(crop_path, 'PNG')

                # 이전 크롭 파일 삭제 (optional)
                old_file = block.get('image_file', '')
                if old_file and old_file.startswith('crop_'):
                    old_path = os.path.join(upload_folder, old_file)
                    if os.path.exists(old_path):
                        os.remove(old_path)

                block['image_file'] = crop_filename

            page.content_images = json.dumps(blocks, ensure_ascii=False)
            db.session.commit()

            return jsonify({
                'success': True,
                'page': page.to_dict()
            })
        else:
            return jsonify({'error': 'Invalid block index'}), 400

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500     