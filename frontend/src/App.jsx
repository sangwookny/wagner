import { useState } from 'react'
import './App.css'

function App() {
  const [germanText, setGermanText] = useState('')
  const [englishText, setEnglishText] = useState('')
  const [koreanText, setKoreanText] = useState('')
  const [isTranslating, setIsTranslating] = useState(false)

  const handleTranslate = async () => {
    if (!germanText.trim()) {
      alert('독일어 텍스트를 입력해주세요!')
      return
    }

    setIsTranslating(true)
    
    // 임시로 가짜 번역 (나중에 AI API로 교체)
    setTimeout(() => {
      setEnglishText(`[English translation of: ${germanText}]`)
      setKoreanText(`[한국어 번역: ${germanText}]`)
      setIsTranslating(false)
    }, 1000)
  }

  const handleSave = () => {
    alert('저장 기능은 나중에 구현할게요!')
  }

  return (
    <div className="container">
      <h1>🇩🇪 Wagner Translator</h1>
      
      <div className="section">
        <label>독일어 텍스트 입력:</label>
        <textarea
          value={germanText}
          onChange={(e) => setGermanText(e.target.value)}
          placeholder="독일어 텍스트를 입력하세요..."
          rows="4"
        />
      </div>

      <button 
        onClick={handleTranslate} 
        disabled={isTranslating}
        className="translate-btn"
      >
        {isTranslating ? '번역 중...' : '🔄 번역하기'}
      </button>

      <div className="section">
        <label>영어 번역 (편집 가능):</label>
        <textarea
          value={englishText}
          onChange={(e) => setEnglishText(e.target.value)}
          placeholder="번역 결과가 여기 표시됩니다..."
          rows="4"
        />
      </div>

      <div className="section">
        <label>한국어 번역 (편집 가능):</label>
        <textarea
          value={koreanText}
          onChange={(e) => setKoreanText(e.target.value)}
          placeholder="번역 결과가 여기 표시됩니다..."
          rows="4"
        />
      </div>

      <button onClick={handleSave} className="save-btn">
        💾 저장하기
      </button>
    </div>
  )
}

export default App