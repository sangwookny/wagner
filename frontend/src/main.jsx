import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import BookList from './BookList.jsx'
import BookReader from './BookReader.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/library" element={<BookList />} />
        <Route path="/read/:bookId" element={<BookReader />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)