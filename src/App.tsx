import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type TestMode = 'time' | 'words' | 'quote' | 'custom'
type DurationOption = 15 | 30 | 60 | 120
type WordOption = 10 | 25 | 50 | 100
type ResultEntry = {
  id: number
  mode: TestMode
  duration: number
  wpm: number
  rawWpm: number
  accuracy: number
  errors: number
  characters: number
  date: string
}

const STORAGE_KEY = 'keyboardtype-history-v1'
const TIME_OPTIONS: DurationOption[] = [15, 30, 60, 120]
const WORD_OPTIONS: WordOption[] = [10, 25, 50, 100]
const SAMPLE_QUOTES = [
  'A calm mind is the best companion for a productive day.',
  'Focus on the rhythm of each key and the work becomes lighter.',
  'Precision matters more than speed when the goal is steady progress.',
  'Consistency is built one deliberate keystroke at a time.',
]
const WORD_BANK = [
  'focus', 'calm', 'steady', 'swift', 'rhythm', 'green', 'craft', 'clear',
  'minute', 'sharp', 'pride', 'pointer', 'screen', 'keyboard', 'typing',
  'practice', 'detail', 'thrive', 'motion', 'habit', 'control', 'balance',
  'flow', 'method', 'signal', 'window', 'level', 'streak', 'motive', 'reach',
]
const DEFAULT_CUSTOM_TEXT = 'Train with your own phrase and keep your rhythm relaxed and accurate.'

function buildWordText(wordCount: number) {
  const words: string[] = []
  for (let index = 0; index < wordCount; index += 1) {
    words.push(WORD_BANK[index % WORD_BANK.length])
  }
  return words.join(' ')
}

function getActiveText(
  mode: TestMode,
  selectedDuration: number,
  selectedWordCount: number,
  customText: string,
  quoteIndex: number,
) {
  if (mode === 'words') {
    return buildWordText(selectedWordCount)
  }

  if (mode === 'quote') {
    return SAMPLE_QUOTES[quoteIndex]
  }

  if (mode === 'custom') {
    return customText.trim() || DEFAULT_CUSTOM_TEXT
  }

  return `${SAMPLE_QUOTES.join(' ')} ${SAMPLE_QUOTES.join(' ')}`.slice(0, Math.max(selectedDuration * 6, 120))
}

function formatHistoryDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function App() {
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const [selectedMode, setSelectedMode] = useState<TestMode>('time')
  const [selectedDuration, setSelectedDuration] = useState<DurationOption>(30)
  const [selectedWordCount, setSelectedWordCount] = useState<WordOption>(50)
  const [customText, setCustomText] = useState(DEFAULT_CUSTOM_TEXT)
  const [quoteIndex, setQuoteIndex] = useState(0)
  const [typedText, setTypedText] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [hasStarted, setHasStarted] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [result, setResult] = useState<ResultEntry | null>(null)
  const [history, setHistory] = useState<ResultEntry[]>(() => {
    if (typeof window === 'undefined') {
      return []
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        return []
      }

      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })

  const currentText = useMemo(
    () => getActiveText(selectedMode, selectedDuration, selectedWordCount, customText, quoteIndex),
    [selectedMode, selectedDuration, selectedWordCount, customText, quoteIndex],
  )

  useEffect(() => {
    setTypedText('')
    setElapsedSeconds(0)
    setHasStarted(false)
    setIsFinished(false)
    setShowResults(false)
    setResult(null)
    inputRef.current?.focus()
  }, [selectedMode, selectedDuration, selectedWordCount, customText, quoteIndex])

  useEffect(() => {
    if (!hasStarted || isFinished) {
      return undefined
    }

    const timerId = window.setInterval(() => {
      setElapsedSeconds((previousValue) => previousValue + 1)
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [hasStarted, isFinished])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
    }
  }, [history])

  useEffect(() => {
    if (!showResults || !result) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) {
        return
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        restartTest()
      }

      if (event.key === 'Escape') {
        setShowResults(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showResults, result])

  useEffect(() => {
    if (isFinished) {
      return
    }

    const timeIsUp = selectedMode === 'time' && elapsedSeconds >= selectedDuration
    const textIsComplete = selectedMode !== 'time' && typedText.length >= currentText.length

    if (!timeIsUp && !textIsComplete) {
      return
    }

    const finalTyped = typedText.length
    const finalCorrect = Array.from(currentText).reduce((total, character, index) => {
      return total + (typedText[index] === character ? 1 : 0)
    }, 0)
    const finalErrors = Math.max(finalTyped - finalCorrect, 0)
    const accuracy = finalTyped === 0 ? 100 : (finalCorrect / finalTyped) * 100
    const minutes = elapsedSeconds > 0 ? elapsedSeconds / 60 : 0
    const wpmValue = minutes > 0 ? (finalCorrect / 5) / minutes : 0
    const rawWpmValue = minutes > 0 ? (finalTyped / 5) / minutes : 0

    const completedResult: ResultEntry = {
      id: Date.now(),
      mode: selectedMode,
      duration: selectedMode === 'time' ? selectedDuration : selectedWordCount,
      wpm: wpmValue,
      rawWpm: rawWpmValue,
      accuracy,
      errors: finalErrors,
      characters: finalTyped,
      date: new Date().toISOString(),
    }

    setResult(completedResult)
    setHistory((previous) => [completedResult, ...previous].slice(0, 50))
    setHasStarted(false)
    setIsFinished(true)
    setShowResults(true)
  }, [currentText, elapsedSeconds, isFinished, selectedDuration, selectedMode, selectedWordCount, typedText])

  const correctCharacters = useMemo(() => {
    return Array.from(currentText).reduce((total, character, index) => {
      return total + (typedText[index] === character ? 1 : 0)
    }, 0)
  }, [currentText, typedText])

  const totalTyped = Math.max(typedText.length, 0)
  const accuracy = totalTyped === 0 ? 100 : (correctCharacters / totalTyped) * 100
  const elapsedMinutes = elapsedSeconds > 0 ? elapsedSeconds / 60 : 0
  const wpm = elapsedMinutes > 0 ? (correctCharacters / 5) / elapsedMinutes : 0
  const rawWpm = elapsedMinutes > 0 ? (totalTyped / 5) / elapsedMinutes : 0
  const errorCount = Math.max(totalTyped - correctCharacters, 0)
  const timeDisplay = selectedMode === 'time' ? Math.max(selectedDuration - elapsedSeconds, 0) : elapsedSeconds

  const handleTypingChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isFinished) {
      return
    }

    const nextValue = event.target.value.slice(0, currentText.length)

    if (!hasStarted && nextValue.length > 0) {
      setHasStarted(true)
    }

    setTypedText(nextValue)
  }

  const restartTest = () => {
    setTypedText('')
    setElapsedSeconds(0)
    setHasStarted(false)
    setIsFinished(false)
    setShowResults(false)
    setResult(null)
    inputRef.current?.focus()
  }

  const switchQuote = () => {
    setQuoteIndex((current) => (current + 1) % SAMPLE_QUOTES.length)
  }

  const handleModeChange = (mode: TestMode) => {
    setSelectedMode(mode)
  }

  const clearHistory = () => {
    const shouldClear = window.confirm('Clear all test history?')
    if (shouldClear) {
      setHistory([])
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-mark">K</span>
          <span className="brand-name">KEYTYPE</span>
        </div>

        <nav className="mode-tabs" aria-label="Test mode selector">
          <button
            type="button"
            className={selectedMode === 'time' ? 'mode-tab active' : 'mode-tab'}
            onClick={() => handleModeChange('time')}
          >
            {selectedDuration}s
          </button>
          <button
            type="button"
            className={selectedMode === 'words' ? 'mode-tab active' : 'mode-tab'}
            onClick={() => handleModeChange('words')}
          >
            {selectedWordCount} words
          </button>
          <button
            type="button"
            className={selectedMode === 'quote' ? 'mode-tab active' : 'mode-tab'}
            onClick={() => {
              handleModeChange('quote')
              switchQuote()
            }}
          >
            Quotes
          </button>
          <button
            type="button"
            className={selectedMode === 'custom' ? 'mode-tab active' : 'mode-tab'}
            onClick={() => handleModeChange('custom')}
          >
            Custom
          </button>
        </nav>
      </header>

      <section className="panel test-panel">
        <div className="settings-row">
          {selectedMode === 'time' && (
            <div className="chip-group" aria-label="Time duration selection">
              {TIME_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={selectedDuration === option ? 'chip active' : 'chip'}
                  onClick={() => setSelectedDuration(option)}
                >
                  {option}s
                </button>
              ))}
            </div>
          )}

          {selectedMode === 'words' && (
            <div className="chip-group" aria-label="Word count selection">
              {WORD_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={selectedWordCount === option ? 'chip active' : 'chip'}
                  onClick={() => setSelectedWordCount(option)}
                >
                  {option}w
                </button>
              ))}
            </div>
          )}

          {selectedMode === 'quote' && (
            <button type="button" className="chip" onClick={switchQuote}>
              New quote
            </button>
          )}
        </div>

        <div className="stats-grid" aria-live="polite">
          <div className="stat-box">
            <span className="stat-label">WPM</span>
            <strong className="stat-value accent">{Math.round(wpm)}</strong>
          </div>
          <div className="stat-box">
            <span className="stat-label">Accuracy</span>
            <strong className="stat-value">{Math.min(Math.max(accuracy, 0), 100).toFixed(0)}%</strong>
          </div>
          <div className="stat-box">
            <span className="stat-label">Time</span>
            <strong className="stat-value">{timeDisplay}s</strong>
          </div>
          <div className="stat-box">
            <span className="stat-label">Errors</span>
            <strong className="stat-value">{errorCount}</strong>
          </div>
        </div>

        <div className="typing-area" onClick={() => inputRef.current?.focus()}>
          <textarea
            ref={inputRef}
            className="typing-input"
            value={typedText}
            onChange={handleTypingChange}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            aria-label="Typing test input"
          />

          <div className="text-display" aria-hidden="true">
            {currentText.split('').map((character, index) => {
              let state = 'untyped'
              const isCurrent = index === typedText.length && !isFinished

              if (typedText[index] && typedText[index] === character) {
                state = 'correct'
              } else if (typedText[index] && typedText[index] !== character) {
                state = 'incorrect'
              }

              return (
                <span key={`${character}-${index}`} className={`char ${state} ${isCurrent ? 'current' : ''}`}>
                  {character === ' ' ? '\u00A0' : character}
                </span>
              )
            })}
          </div>
        </div>

        {selectedMode === 'custom' && (
          <label className="custom-box">
            <span className="custom-label">Custom text</span>
            <textarea
              value={customText}
              onChange={(event) => setCustomText(event.target.value)}
              rows={4}
              spellCheck={false}
            />
          </label>
        )}

        <div className="action-row">
          <button type="button" className="action-button primary" onClick={restartTest}>
            Restart
          </button>
          <button type="button" className="action-button" onClick={() => handleModeChange('time')}>
            New test
          </button>
        </div>
      </section>

      <section className="panel summary-panel">
        <div className="summary-header">
          <span>Live summary</span>
          <strong>{Math.round(rawWpm)} raw</strong>
        </div>
        <div className="summary-grid">
          <div>
            <span>Correct</span>
            <strong>{correctCharacters}</strong>
          </div>
          <div>
            <span>Raw WPM</span>
            <strong>{Math.round(rawWpm)}</strong>
          </div>
          <div>
            <span>Characters</span>
            <strong>{totalTyped}</strong>
          </div>
        </div>
      </section>

      <section className="panel history-panel">
        <div className="history-header">
          <div>
            <p className="history-label">History</p>
            <h3>Recent sessions</h3>
          </div>
          {history.length > 0 && (
            <button type="button" className="history-clear" onClick={clearHistory}>
              Clear
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <p className="empty-history">No completed tests yet.</p>
        ) : (
          <ul className="history-list">
            {history.map((entry) => (
              <li key={entry.id} className="history-item">
                <span className="history-date">{formatHistoryDate(entry.date)}</span>
                <span className="history-mode">{entry.mode}</span>
                <span className="history-score">{Math.round(entry.wpm)} WPM</span>
                <span className="history-accuracy">{Math.round(entry.accuracy)}%</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showResults && result && (
        <div className="results-overlay" aria-live="polite">
          <div className="results-card">
            <p className="result-kicker">Test complete</p>
            <h2>{Math.round(result.wpm)} WPM</h2>

            <div className="result-grid">
              <div>
                <span>Accuracy</span>
                <strong>{Math.round(result.accuracy)}%</strong>
              </div>
              <div>
                <span>Raw WPM</span>
                <strong>{Math.round(result.rawWpm)}</strong>
              </div>
              <div>
                <span>Characters</span>
                <strong>{result.characters}</strong>
              </div>
              <div>
                <span>Errors</span>
                <strong>{result.errors}</strong>
              </div>
            </div>

            <div className="result-actions">
              <button type="button" className="action-button primary" onClick={restartTest}>
                Restart
              </button>
              <button type="button" className="action-button" onClick={() => handleModeChange('time')}>
                New test
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default App
