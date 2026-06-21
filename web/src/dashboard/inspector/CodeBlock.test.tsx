import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { CodeBlock } from './CodeBlock'

describe('CodeBlock', () => {
  it('renders multi-line code with a line number per line', () => {
    const { container } = render(<CodeBlock code={'import re\ndef f():\n    return 1'} />)
    const lines = container.querySelectorAll('.cb__line')
    expect(lines).toHaveLength(3)
    const gutter = Array.from(container.querySelectorAll('.cb__ln')).map((e) => e.textContent)
    expect(gutter).toEqual(['1', '2', '3'])
    // the source text survives tokenization
    expect(container.textContent).toContain('import')
    expect(container.textContent).toContain('return')
  })

  it('trims trailing blank lines', () => {
    const { container } = render(<CodeBlock code={'x = 1\n\n'} />)
    expect(container.querySelectorAll('.cb__line')).toHaveLength(1)
  })
})
