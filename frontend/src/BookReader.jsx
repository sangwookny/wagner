import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import './BookReader.css'

const API_URL = 'http://127.0.0.1:5000/api'

function BookReader() {
  const { bookId } = useParams()
  const [book, setBook] = useState(null)
  const [pages, setPages] = useState([])
  const [currentPage, setCurrentPage] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [activeSentence, setActiveSentence] = useState(null)

  useEffect(() => {
    fetchBook()
  }, [bookId])

  const fetchBook = async () => {
    try {
      const bookRes = await fetch(`${API_URL}/books/${bookId}`)
      const bookData = await bookRes.json()
      const pagesRes = await fetch(`${API_URL}/books/${bookId}/pages`)
      const pagesData = await pagesRes.json()
      if (bookData.success) setBook(bookData.book)
      if (pagesData.success) setPages(pagesData.pages)
    } catch (err) {
      console.error('Failed to load book:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const goToPrev = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1)
      setActiveSentence(null)
    }
  }

  const goToNext = () => {
    if (currentPage < pages.length - 1) {
      setCurrentPage(currentPage + 1)
      setActiveSentence(null)
    }
  }

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft') goToPrev()
      if (e.key === 'ArrowRight') goToNext()
      if (e.key === 'Escape') setActiveSentence(null)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [currentPage, pages.length])

  const handleSentenceClick = (idx) => {
    setActiveSentence(activeSentence === idx ? null : idx)
  }

  const getContentBlocks = (page) => {
    if (page.content_images) {
      try {
        const blocks = typeof page.content_images === 'string'
          ? JSON.parse(page.content_images)
          : page.content_images
        if (Array.isArray(blocks) && blocks.length > 0) return blocks
      } catch (e) {}
    }
    return null
  }

  const renderContentWithBlocks = (page, sentences) => {
    const blocks = getContentBlocks(page)
    if (!blocks) return null

    let sentenceIdx = 0
    return blocks.map((block, blockIdx) => {
      if (block.type === 'text') {
        // 이 텍스트 블록에 해당하는 문장들 렌더링
        const blockSentences = []
        const blockText = block.content || ''
        const sentenceCount = blockText.split('.').filter(s => s.trim()).length
        const count = Math.max(1, Math.min(sentenceCount, sentences.length - sentenceIdx))

        for (let i = 0; i < count && sentenceIdx < sentences.length; i++) {
          const sIdx = sentenceIdx
          blockSentences.push(
            <span key={sIdx} className="sentence-wrapper">
              <span
                className={`reader-sentence ${activeSentence === sIdx ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  handleSentenceClick(sIdx)
                }}
              >
                {sentences[sIdx].ko}
              </span>
              {activeSentence === sIdx && (
                <span className="sentence-reveal" onClick={(e) => e.stopPropagation()}>
                  <span className="reveal-line"></span>
                  <span className="reveal-content">
                    <span className="reveal-lang">
                      <span className="reveal-flag">🇩🇪</span>
                      <span className="reveal-text">{sentences[sIdx].de}</span>
                    </span>
                    <span className="reveal-divider"></span>
                    <span className="reveal-lang">
                      <span className="reveal-flag">🇬🇧</span>
                      <span className="reveal-text">{sentences[sIdx].en}</span>
                    </span>
                  </span>
                </span>
              )}
              {' '}
            </span>
          )
          sentenceIdx++
        }
        return <div key={blockIdx} className="reader-text-block">{blockSentences}</div>

      } else if (block.type === 'music_score') {
        return (
          <div key={blockIdx} className="reader-score-block">
            <div className="score-container">
              {block.image_file && (
                <img
                  src={`${API_URL.replace('/api', '')}/api/uploads/${block.image_file}`}
                  alt="악보"
                  className="score-image"
                />
              )}
              <p className="score-description">🎵 {block.description}</p>
            </div>
          </div>
        )

      } else if (block.type === 'illustration') {
        return (
          <div key={blockIdx} className="reader-illustration-block">
            <div className="illustration-container">
              {block.image_file && (
                <img
                  src={`${API_URL.replace('/api', '')}/api/uploads/${block.image_file}`}
                  alt="삽화"
                  className="illustration-image"
                />
              )}
              <p className="illustration-description">🖼️ {block.description}</p>
            </div>
          </div>
        )
      }
      return null
    })
  }

  if (isLoading) {
    return (
      <div className="reader-loading">
        <div className="reader-spinner"></div>
        <p>책을 불러오는 중...</p>
      </div>
    )
  }

  if (!book || pages.length === 0) {
    return (
      <div className="reader-empty">
        <h1>📖</h1>
        <p>아직 페이지가 없습니다</p>
        <a href="/library">← 서재로 돌아가기</a>
      </div>
    )
  }

  const page = pages[currentPage]
  const sentences = page.sentences || []
  const hasBlocks = getContentBlocks(page)

  return (
    <div className="reader-container" onClick={() => setActiveSentence(null)}>
      <header className="reader-header">
        <a href="/library" className="reader-back">← 서재</a>
        <div className="reader-title">
          <h1>{book.title}</h1>
          {book.author && <span className="reader-author">{book.author}</span>}
        </div>
        <span className="reader-page-info">{currentPage + 1} / {pages.length}</span>
      </header>

      <main className="reader-body">
        <div className="reader-page">
          <div className="reader-text">
            {hasBlocks ? (
              renderContentWithBlocks(page, sentences)
            ) : sentences.length > 0 ? (
              sentences.map((s, idx) => (
                <span key={idx} className="sentence-wrapper">
                  <span
                    className={`reader-sentence ${activeSentence === idx ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSentenceClick(idx)
                    }}
                  >
                    {s.ko}
                  </span>
                  {activeSentence === idx && (
                    <span className="sentence-reveal" onClick={(e) => e.stopPropagation()}>
                      <span className="reveal-line"></span>
                      <span className="reveal-content">
                        <span className="reveal-lang">
                          <span className="reveal-flag">🇩🇪</span>
                          <span className="reveal-text">{s.de}</span>
                        </span>
                        <span className="reveal-divider"></span>
                        <span className="reveal-lang">
                          <span className="reveal-flag">🇬🇧</span>
                          <span className="reveal-text">{s.en}</span>
                        </span>
                      </span>
                    </span>
                  )}
                  {' '}
                </span>
              ))
            ) : (
              page.korean_text && page.korean_text.split('\n').map((paragraph, idx) => (
                paragraph.trim() && (
                  <p key={idx} className="reader-paragraph">{paragraph}</p>
                )
              ))
            )}
          </div>
          <div className="reader-page-number">{page.page_number}</div>
        </div>
      </main>

      <nav className="reader-nav">
        <button onClick={goToPrev} disabled={currentPage === 0} className="reader-nav-btn">
          ← 이전
        </button>
        <div className="reader-progress">
          <div
            className="reader-progress-bar"
            style={{ width: `${((currentPage + 1) / pages.length) * 100}%` }}
          />
        </div>
        <button onClick={goToNext} disabled={currentPage === pages.length - 1} className="reader-nav-btn">
          다음 →
        </button>
      </nav>
    </div>
  )
}

export default BookReader