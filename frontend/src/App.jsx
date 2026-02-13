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
  const [editingField, setEditingField] = useState(null)
  const [editText, setEditText] = useState('')
  const [editingCrop, setEditingCrop] = useState(null)
  const [cropTop, setCropTop] = useState(0)
  const [cropBottom, setCropBottom] = useState(100)
  const [isCropping, setIsCropping] = useState(false)

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
          page_type: data.page_type || 'text',
          original_image_url: data.saved_image || '',
          content_images: JSON.stringify(data.content_blocks || [])
        }
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

  const handleDeletePage = async (pageId) => {
    if (!confirm('이 페이지를 삭제하시겠어요? 되돌릴 수 없습니다.')) return
    try {
      const res = await fetch(`${API_URL}/pages/${pageId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        const newPages = pages.filter(p => p.id !== pageId)
        setPages(newPages)
        if (currentPage >= newPages.length) {
          setCurrentPage(Math.max(0, newPages.length - 1))
        }
      }
    } catch (err) {
      alert('삭제 실패: ' + err.message)
    }
  }

  const handleMovePage = async (pageId, direction) => {
    try {
      const res = await fetch(`${API_URL}/pages/${pageId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction })
      })
      const data = await res.json()
      if (data.success) {
        setPages(data.pages)
        if (direction === 'up') setCurrentPage(Math.max(0, currentPage - 1))
        if (direction === 'down') setCurrentPage(Math.min(data.pages.length - 1, currentPage + 1))
      }
    } catch (err) {
      alert('이동 실패: ' + err.message)
    }
  }

  const startEditing = (field, text) => {
    setEditingField(field)
    setEditText(text)
  }

  const saveEdit = async (pageId) => {
    try {
      const res = await fetch(`${API_URL}/pages/${pageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [editingField]: editText })
      })
      const data = await res.json()
      if (data.success) {
        const updatedPages = pages.map(p => p.id === pageId ? data.page : p)
        setPages(updatedPages)
        setEditingField(null)
        setEditText('')
      }
    } catch (err) {
      alert('수정 실패: ' + err.message)
    }
  }

  const cancelEdit = () => {
    setEditingField(null)
    setEditText('')
  }

  const startCropEdit = (block, blockIdx) => {
    const crop = block.crop_percent || { top: 0, bottom: 100 }
    setCropTop(crop.top)
    setCropBottom(crop.bottom)
    setEditingCrop(blockIdx)
  }

  const saveCropEdit = async (pageId) => {
    setIsCropping(true)
    try {
      const res = await fetch(`${API_URL}/pages/${pageId}/recrop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          block_index: editingCrop,
          crop_top: cropTop,
          crop_bottom: cropBottom
        })
      })
      const data = await res.json()
      if (data.success) {
        const updatedPages = pages.map(p => p.id === pageId ? data.page : p)
        setPages(updatedPages)
        setEditingCrop(null)
      }
    } catch (err) {
      alert('크롭 수정 실패: ' + err.message)
    } finally {
      setIsCropping(false)
    }
  }

  const handleRetranslate = async (pageId) => {
    if (!confirm('재번역하시겠어요? (한국어+영어 모두 새로 번역됩니다)')) return
    try {
      const res = await fetch(`${API_URL}/pages/${pageId}/retranslate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field: 'all' })
      })
      const data = await res.json()
      if (data.success) {
        const updatedPages = pages.map(p => p.id === pageId ? data.page : p)
        setPages(updatedPages)
        alert(`v${data.new_version}으로 재번역 완료!`)
      }
    } catch (err) {
      alert('재번역 실패: ' + err.message)
    }
  }

  const getImageBlocks = (page) => {
    if (!page.content_images) return []
    try {
      const blocks = typeof page.content_images === 'string'
        ? JSON.parse(page.content_images)
        : page.content_images
      return blocks.filter(b => b.type === 'music_score' || b.type === 'illustration')
    } catch (e) {
      return []
    }
  }

  // 책 목록 화면
  if (!currentBook) {
    return (
      <div className="container">
        <div className="home-screen">
          <h1>📖 Wagner 편집실</h1>
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
              <input type="text" placeholder="책 제목" value={newBookTitle} onChange={(e) => setNewBookTitle(e.target.value)} className="book-input" autoFocus />
              <input type="text" placeholder="저자 (선택)" value={newBookAuthor} onChange={(e) => setNewBookAuthor(e.target.value)} className="book-input" />
              <div className="form-buttons">
                <button onClick={createBook} className="create-btn">생성</button>
                <button onClick={() => setIsCreatingBook(false)} className="cancel-btn">취소</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setIsCreatingBook(true)} className="start-btn">+ 새 책 만들기</button>
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

  const page = pages[currentPage]
  const imageBlocks = getImageBlocks(page)

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

        <div className="page-controls">
          <button onClick={() => handleMovePage(page.id, 'up')} disabled={currentPage === 0} className="control-btn">⬆ 위로</button>
          <button onClick={() => handleMovePage(page.id, 'down')} disabled={currentPage === pages.length - 1} className="control-btn">⬇ 아래로</button>
          <button onClick={() => handleDeletePage(page.id)} className="control-btn delete-btn">🗑 삭제</button>
        </div>

        {/* 한국어 번역 */}
        <div className="edit-section">
          <div className="edit-header">
            <h3>🇰🇷 한국어 번역</h3>
            {editingField !== 'korean_text' && (
              <button onClick={() => startEditing('korean_text', page.korean_text)} className="edit-btn">✏️ 수정</button>
            )}
          </div>
          {editingField === 'korean_text' ? (
            <div className="edit-area">
              <textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="edit-textarea" rows={8} />
              <div className="edit-buttons">
                <button onClick={() => saveEdit(page.id)} className="save-btn">저장</button>
                <button onClick={cancelEdit} className="cancel-btn">취소</button>
              </div>
            </div>
          ) : (
            <div className="book-content">
              <div className="korean-text">{page.korean_text}</div>
            </div>
          )}
        </div>

        {/* 악보/이미지 크롭 편집 */}
        {imageBlocks.length > 0 && (
          <div className="crop-editor-section">
            <h3>{page.page_type === 'music' ? '🎵 악보' : '🖼️ 이미지'} 크롭 편집</h3>
            {imageBlocks.map((block, idx) => {
              const realIdx = (() => {
                let blocks = []
                try {
                  blocks = typeof page.content_images === 'string'
                    ? JSON.parse(page.content_images) : page.content_images
                } catch (e) {}
                let count = 0
                for (let i = 0; i < blocks.length; i++) {
                  if (blocks[i].type === 'music_score' || blocks[i].type === 'illustration') {
                    if (count === idx) return i
                    count++
                  }
                }
                return 0
              })()

              return (
                <div key={idx} className="crop-editor">
                  <div className="crop-preview">
                    {block.image_file && (
                      <img
                        src={`${API_URL.replace('/api', '')}/api/uploads/${block.image_file}`}
                        alt="현재 크롭"
                        className="crop-preview-img"
                      />
                    )}
                    <p className="crop-desc">{block.description}</p>
                  </div>

                  {editingCrop === realIdx ? (
                    <div className="crop-controls">
                      <div className="crop-slider-group">
                        <label>시작 위치 (상단): <strong>{cropTop}%</strong></label>
                        <input type="range" min="0" max="100" value={cropTop} onChange={(e) => setCropTop(Number(e.target.value))} className="crop-slider" />
                      </div>
                      <div className="crop-slider-group">
                        <label>끝 위치 (하단): <strong>{cropBottom}%</strong></label>
                        <input type="range" min="0" max="100" value={cropBottom} onChange={(e) => setCropBottom(Number(e.target.value))} className="crop-slider" />
                      </div>

                      {page.original_image_url && (
                        <div className="crop-preview-overlay">
                          <p>원본에서 선택 영역:</p>
                          <div className="crop-overlay-wrap">
                            <img
                              src={`${API_URL.replace('/api', '')}/api/uploads/${page.original_image_url}`}
                              alt="원본"
                              className="crop-original-img"
                            />
                            <div className="crop-dim-top" style={{ height: `${cropTop}%` }} />
                            <div className="crop-dim-bottom" style={{ height: `${100 - cropBottom}%` }} />
                          </div>
                        </div>
                      )}

                      <div className="edit-buttons">
                        <button onClick={() => saveCropEdit(page.id)} className="save-btn" disabled={isCropping}>
                          {isCropping ? '처리 중...' : '✂️ 크롭 저장'}
                        </button>
                        <button onClick={() => setEditingCrop(null)} className="cancel-btn">취소</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => startCropEdit(block, realIdx)} className="edit-btn">✂️ 크롭 조정</button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* 원문 섹션 */}
        <div className="original-section">
          <details>
            <summary>원문 보기 (독일어)</summary>
            {editingField === 'german_text' ? (
              <div className="edit-area">
                <textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="edit-textarea" rows={8} />
                <div className="edit-buttons">
                  <button onClick={() => saveEdit(page.id)} className="save-btn">저장</button>
                  <button onClick={cancelEdit} className="cancel-btn">취소</button>
                </div>
              </div>
            ) : (
              <div className="original-content">
                <p className="original-text">{page.german_text}</p>
                <button onClick={() => startEditing('german_text', page.german_text)} className="edit-btn-small">✏️ 수정</button>
              </div>
            )}
          </details>
          <details>
            <summary>영어 번역 보기</summary>
            {editingField === 'english_text' ? (
              <div className="edit-area">
                <textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="edit-textarea" rows={8} />
                <div className="edit-buttons">
                  <button onClick={() => saveEdit(page.id)} className="save-btn">저장</button>
                  <button onClick={cancelEdit} className="cancel-btn">취소</button>
                </div>
              </div>
            ) : (
              <div className="original-content">
                <p className="english-text">{page.english_text}</p>
                <button onClick={() => startEditing('english_text', page.english_text)} className="edit-btn-small">✏️ 수정</button>
              </div>
            )}
          </details>
        </div>

        <div className="action-buttons">
          <button onClick={() => handleRetranslate(page.id)} className="retranslate-btn">🔄 재번역 (한국어+영어)</button>
        </div>

        <div className="add-page-section">
          <button onClick={() => setIsUploading(true)} className="add-page-btn">+ 새 페이지 추가하기</button>
        </div>
      </div>
    </div>
  )
}

export default App