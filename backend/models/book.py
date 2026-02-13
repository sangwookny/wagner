from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Book(db.Model):
    __tablename__ = 'books'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    author = db.Column(db.String(100))
    original_language = db.Column(db.String(50), default='german')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    published = db.Column(db.Boolean, default=False)

    pages = db.relationship('Page', backref='book', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'author': self.author,
            'original_language': self.original_language,
            'created_at': self.created_at.isoformat(),
            'published': self.published,
            'page_count': len(self.pages)
        }


class Page(db.Model):
    __tablename__ = 'pages'

    id = db.Column(db.Integer, primary_key=True)
    book_id = db.Column(db.Integer, db.ForeignKey('books.id'), nullable=False)
    page_number = db.Column(db.Integer, nullable=False)
    page_type = db.Column(db.String(20), default='text')

    german_text = db.Column(db.Text)
    korean_text = db.Column(db.Text)
    english_text = db.Column(db.Text)
    sentences_json = db.Column(db.Text)

    original_image_url = db.Column(db.String(500))
    content_images = db.Column(db.Text)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    translation_history = db.relationship('TranslationHistory', backref='page', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        import json
        sentences = None
        if self.sentences_json:
            try:
                sentences = json.loads(self.sentences_json)
            except:
                sentences = None

        return {
            'id': self.id,
            'book_id': self.book_id,
            'page_number': self.page_number,
            'page_type': self.page_type,
            'german_text': self.german_text,
            'korean_text': self.korean_text,
            'english_text': self.english_text,
            'sentences': sentences,
            'original_image_url': self.original_image_url,
            'content_images': self.content_images,
            'created_at': self.created_at.isoformat()
        }


class TranslationHistory(db.Model):
    __tablename__ = 'translation_history'

    id = db.Column(db.Integer, primary_key=True)
    page_id = db.Column(db.Integer, db.ForeignKey('pages.id'), nullable=False)
    field = db.Column(db.String(50), nullable=False)
    translation_text = db.Column(db.Text, nullable=False)
    version_number = db.Column(db.Integer, default=1)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'page_id': self.page_id,
            'field': self.field,
            'translation_text': self.translation_text,
            'version_number': self.version_number,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat()
        }