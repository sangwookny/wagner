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

@book_bp.route('/pages/<int:page_id>/retranslate', methods=['POST'])
def retranslate_page(page_id):
    from services.openai_service import translate_with_sentence_mapping
    page = Page.query.get_or_404(page_id)
    data = request.json
    field = data.get('field')
    if field not in ['korean', 'english', 'all']:
        return jsonify({'error': 'Invalid field'}), 400
    try:
        # 문장 매핑으로 재번역
        sentences = translate_with_sentence_mapping(page.german_text)
        
        new_korean = '\n'.join([s['ko'] for s in sentences])
        new_english = '\n'.join([s['en'] for s in sentences])
        
        # 페이지 업데이트
        page.korean_text = new_korean
        page.english_text = new_english
        page.sentences_json = json.dumps(sentences, ensure_ascii=False)
        
        # 버전 히스토리 - 한국어
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
        
        # 버전 히스토리 - 영어
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