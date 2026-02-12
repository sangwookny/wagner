import { useState } from 'react'
import './App.css'

function App() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [extractedText, setExtractedText] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      setSelectedFile(file)
      // 미리보기 생성
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleOCR = async () => {
    if (!selectedFile) {
      alert('이미지를 먼저 선택해주세요!')
      return
    }

    setIsProcessing(true)
    const formData = new FormData()
    formData.append('image', selectedFile)

    try {
      const response = await fetch('http://127.0.0.1:5000/api/ocr', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()
      
      if (data.success) {
        setExtractedText(data.text)
      } else {
        alert('OCR 처리 실패: ' + data.error)
      }
    } catch (error) {
      alert('오류 발생: ' + error.message)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="container">
      <h1>🇩🇪 Wagner OCR</h1>
      
      <div className="upload-section">
        <label htmlFor="file-upload" className="file-label">
          📸 이미지 선택
        </label>
        <input
          id="file-upload"
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>

      {preview && (
        <div className="preview-section">
          <h3>미리보기:</h3>
          <img src={preview} alt="Preview" className="preview-image" />
          <button onClick={handleOCR} disabled={isProcessing} className="ocr-btn">
            {isProcessing ? '처리 중...' : '🔍 텍스트 추출'}
          </button>
        </div>
      )}

      {extractedText && (
        <div className="result-section">
          <h3>추출된 독일어 텍스트:</h3>
          <textarea
            value={extractedText}
            onChange={(e) => setExtractedText(e.target.value)}
            rows="10"
            className="result-text"
          />
        </div>
      )}
    </div>
  )
}

export default App