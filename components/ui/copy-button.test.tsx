import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CopyButton } from './copy-button'
import React from 'react'

// @vitest-environment jsdom

describe('CopyButton', () => {
  const writeTextMock = vi.fn()

  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders correctly with default label', () => {
    render(<CopyButton value="test value" />)
    const button = screen.getByRole('button', { name: 'Copy' })
    expect(button).toBeDefined()
  })

  it('renders correctly with custom label', () => {
    render(<CopyButton value="test value" label="Copy Text" />)
    const button = screen.getByRole('button', { name: 'Copy Text' })
    expect(button).toBeDefined()
  })

  it('copies text to clipboard when clicked', () => {
    render(<CopyButton value="test value" />)
    const button = screen.getByRole('button', { name: 'Copy' })

    fireEvent.click(button)

    expect(writeTextMock).toHaveBeenCalledWith('test value')
  })

  // We can't easily test the visual feedback because it relies on state updates and timeouts which might be tricky in this setup without act(),
  // but checking the clipboard call is the most important part.
})
