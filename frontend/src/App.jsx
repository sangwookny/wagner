import { useState, useEffect } from 'react'
import './App.css'

const API_URL = 'http://127.0.0.1:5000/api'

function App() {
  const [books, setBooks] = useState([])
  const [currentBook, setCurrentBook] = useState(null)
  const [pages, setPages] = useState([])
  const [currentPage, setCurrentPage] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isCreatingBook, setIsCreatingBook] = useState(false)
  const [newBookTitle, setNewBookTitle] = useState('')
  const [newBookAuthor, setNewBookAuthor] = useState('')
  const [continuationData, setContinuationData] = useState(null)
  const [pendingPage, setPendingPage] = useState(null)

  // 앱 시작 시 책 목록 불러오기
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
    }
  }

  const createBook = async () => {
    if (!newBookTitle.trim()) {
      alert('책 제목을 입력해주세요!')
      return
    }
    try {
      const res = await fetch(`${API_URL}/books`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newBookTitle, author: newBookAuthor })
      })
      const data = await res.json()
      if (data.success) {
        setCurrentBook(data.book)
        setPages([])
        setCurrentPage(0)
        setIsCreatingBook(false)
        setNewBookTitle('')
        setNewBookAuthor('')
        fetchBooks()
      }
    } catch (err) {
      alert('책 생성 실패: ' + err.message)
    }
  }

  const openBook = async (book) => {
    setCurrentBook(book)
    try {
      const res = await fetch(`${API_URL}/books/${book.id}/pages`)
      const data = await res.json()
      if (data.success) {
        setPages(data.pages)
        setCurrentPage(0)
      }
    } catch (err) {
      alert('페이지 불러오기 실패: ' + err.message)
    }
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files[0]
    if (!file || !currentBook) return

    setIsProcessing(true)
    const formData = new FormData()
    formData.append('image', file)

    if (pages.length > 0) {
      const lastPage = pages[pages.length - 1]
      formData.append('previous_korean', lastPage.korean_text || '')
      formData.append('previous_german', lastPage.german_text || '')
    }

    try {
      const res = await fetch(`${API_URL}/ocr`, {
        method: 'POST',
        body: formData
      })
      const data = await res.json()

      if (data.success) {
        const newPageData = {
          german_text: data.original,
          korean_text: data.korean,
          english_text: data.english,
          sentences: data.sentences,
          page_type: 'text'
        }

        // 연속성 체크
        if (data.continuation && data.continuation.is_continuation && data.continuation.confidence > 0.7) {
          setContinuationData(data.continuation)
          setPendingPage(newPageData)
          setIsProcessing(false)
          return
        }

        // DB에 페이지 저장
        await savePageToDB(newPageData)
      } else {
        alert('처리 실패: ' + data.error)
      }
    } catch (err) {
      alert('오류 발생: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const savePageToDB = async (pageData) => {
    try {
      const res = await fetch(`${API_URL}/books/${currentBook.id}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pageData)
      })
      const data = await res.json()
      if (data.success) {
        setPages([...pages, data.page])
        setCurrentPage(pages.length)
        setIsUploading(false)
      }
    } catch (err) {
      alert('저장 실패: ' + err.message)
    }
  }

  const handleMergePages = async () => {
    if (!pendingPage || !continuationData) return
    // 이전 페이지 텍스트에 병합
    const lastPage = pages[pages.length - 1]
    const mergedKorean = continuationData.merged_text
    // TODO: 이전 페이지 업데이트 API 필요
    // 일단 새 페이지로 저장
    await savePageToDB(pendingPage)
    setContinuationData(null)
    setPendingPage(null)
  }

  const handleKeepSeparate = async () => {
    if (!pendingPage) return
    await savePageToDB(pendingPage)
    setContinuationData(null)
    setPendingPage(null)
  }

  const handleRetranslate = async (pageId, field) => {
    if (!confirm(`${field === 'korean' ? '한국어' : '영어'} 번역을 다시 하시겠어요?`)) return
    try {
      const res = await fetch(`${API_URL}/pages/${pageId}/retranslate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field })
      })
      const data = await res.json()
      if (data.success) {
        const updatedPages = pages.map(p =>
          p.id === pageId ? data.page : p
        )
        setPages(updatedPages)
        alert(`v${data.new_version}으로 재번역 완료!`)
      }
    } catch (err) {
      alert('재번역 실패: ' + err.message)
    }
  }

  // 연속성 확인 모달
  if (continuationData && pendingPage) {
    return (
      <div className="container">
        <div className="continuation-modal">
          <h2>🔗 문장이 이어지는 것 같아요</h2>
          <div className="continuation-preview">
            <div className="preview-box">
              <h3>이전 페이지 끝:</h3>
              <p className="preview-text">
                ...{pages[pages.length - 1]?.korean_text?.slice(-100)}
              </p>
            </div>
            <div className="preview-box">
              <h3>새 페이지 시작:</h3>
              <p className="preview-text">
                {pendingPage.korean_text?.slice(0, 100)}...
              </p>
            </div>
            <div className="merged-preview">
              <h3>✨ 합친 결과:</h3>
              <p className="merged-text">{continuationData.merged_text}</p>
              <p className="confidence">확신도: {Math.round(continuationData.confidence * 100)}%</p>
            </div>
          </div>
          <div className="modal-buttons">
            <button onClick={handleMergePages} className="merge-btn">이어붙이기</button>
            <button onClick={handleKeepSeparate} className="separate-btn">별도 페이지로</button>
          </div>
        </div>
      </div>
    )
  }

  // 책 목록 화면
  if (!currentBook) {
    return (
      <div className="container">
        <div className="home-screen">
          <h1>📖 Wagner 전자책</h1>
          <p>독일어 책을 한국어로 번역하세요</p>

          {books.length > 0 && (
            <div className="book-list">
              <h2>내 책 목록</h2>
              {books.map(book => (
                <div key={book.id} className="book-card" onClick={() => openBook(book)}>
                  <h3>{book.title}</h3>
                  <p>{book.author || '저자 미입력'} · {book.page_count}페이지</p>
                </div>
              ))}
            </div>
          )}

          {isCreatingBook ? (
            <div className="create-book-form">
              <input
                type="text"
                placeholder="책 제목"
                value={newBookTitle}
                onChange={(e) => setNewBookTitle(e.target.value)}
                className="book-input"
                autoFocus
              />
              <input
                type="text"
                placeholder="저자 (선택)"
                value={newBookAuthor}
                onChange={(e) => setNewBookAuthor(e.target.value)}
                className="book-input"
              />
              <div className="form-buttons">
                <button onClick={createBook} className="create-btn">생성</button>
                <button onClick={() => setIsCreatingBook(false)} className="cancel-btn">취소</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setIsCreatingBook(true)} className="start-btn">
              + 새 책 만들기
            </button>
          )}
        </div>
      </div>
    )
  }

  // 업로드 중
  if (isUploading) {
    return (
      <div className="container">
        <div className="upload-modal">
          <h2>📸 새 페이지 추가</h2>
          <p>독일어 책 이미지를 선택해주세요</p>
          <label htmlFor="file-upload" className="file-label">이미지 선택</label>
          <input id="file-upload" type="file" accept="image/*" onChange={handleFileSelect} style={{ display: 'none' }} />
          {isProcessing && (
            <div className="processing">
              <div className="spinner"></div>
              <p>OCR + 번역 처리 중...</p>
            </div>
          )}
          <button onClick={() => setIsUploading(false)} className="cancel-btn" disabled={isProcessing}>취소</button>
        </div>
      </div>
    )
  }

  // 페이지 없을 때
  if (pages.length === 0) {
    return (
      <div className="container">
        <div className="empty-state">
          <button onClick={() => setCurrentBook(null)} className="back-btn">← 책 목록</button>
          <h1>📖 {currentBook.title}</h1>
          <p>첫 페이지를 추가해주세요</p>
          <button onClick={() => setIsUploading(true)} className="start-btn">첫 페이지 추가하기</button>
        </div>
      </div>
    )
  }

  // 책 뷰어
  const page = pages[currentPage]

  return (
    <div className="container">
      <div className="book-viewer">
        <div className="book-title-bar">
          <button onClick={() => setCurrentBook(null)} className="back-btn">← 책 목록</button>
          <h2>{currentBook.title}</h2>
        </div>

        <div className="page-nav">
          <button onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 0} className="nav-btn">← 이전</button>
          <span className="page-indicator">{currentPage + 1} / {pages.length}</span>
          <button onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage === pages.length - 1} className="nav-btn">다음 →</button>
        </div>

        <div className="book-content">
          <div className="page-number">페이지 {page.page_number}</div>
          <div className="korean-text">{page.korean_text}</div>
        </div>

        <div className="original-section">
          <details>
            <summary>원문 보기 (독일어)</summary>
            <p className="original-text">{page.german_text}</p>
          </details>
          <details>
            <summary>영어 번역 보기</summary>
            <p className="english-text">{page.english_text}</p>
          </details>
        </div>

        <div className="action-buttons">
          <button onClick={() => handleRetranslate(page.id, 'korean')} className="retranslate-btn">🔄 한국어 재번역</button>
          <button onClick={() => handleRetranslate(page.id, 'english')} className="retranslate-btn">🔄 영어 재번역</button>
        </div>

        <div className="add-page-section">
          <button onClick={() => setIsUploading(true)} className="add-page-btn">+ 새 페이지 추가하기</button>
        </div>
      </div>
    </div>
  )
}

export default App