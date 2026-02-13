import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './BookList.css'

const API_URL = 'http://127.0.0.1:5000/api'

function BookList() {
  const [books, setBooks] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetchBooks()
  }, [])

  const fetchBooks = async () => {
    try {
      const res = await fetch(`${API_URL}/books`)
      const data = await res.json()
      if (data.success) setBooks(data.books)
    } catch (err) {
      console.error('Failed to fetch books:', err)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="bl-loading">
        <div className="bl-spinner"></div>
      </div>
    )
  }

  return (
    <div className="bl-container">
      <header className="bl-header">
        <div className="bl-logo">W</div>
        <h1 className="bl-title">Wagner Bibliothek</h1>
        <p className="bl-subtitle">독일 고전 문헌의 한국어 번역 서재</p>
        <div className="bl-line"></div>
      </header>

      <main className="bl-main">
        {books.length === 0 ? (
          <p className="bl-empty">아직 등록된 서적이 없습니다</p>
        ) : (
          <div className="bl-books">
            {books.map(book => (
              <div
                key={book.id}
                className="bl-book"
                onClick={() => navigate(`/read/${book.id}`)}
              >
                <div className="bl-book-spine"></div>
                <div className="bl-book-body">
                  <h2 className="bl-book-title">{book.title}</h2>
                  <p className="bl-book-author">{book.author || '저자 미상'}</p>
                  <div className="bl-book-meta">
                    <span>{book.page_count}쪽</span>
                    <span>·</span>
                    <span>독일어 원문</span>
                  </div>
                </div>
                <div className="bl-book-arrow">→</div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="bl-footer">
        <p>Übersetzung mit Sorgfalt — 정성을 담은 번역</p>
      </footer>
    </div>
  )
}

export default BookList