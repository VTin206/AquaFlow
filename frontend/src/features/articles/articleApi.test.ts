import { describe, expect, it } from 'vitest'
import { articleBlocks } from './articleApi'

describe('articleBlocks', () => {
  it('treats each non-empty line as a paragraph and "## " lines as headings', () => {
    expect(articleBlocks('Mở đầu\r\n\r\n## Bình úp  \n  Dùng với cây nước.\n##không phải tiêu đề')).toEqual([
      { kind: 'paragraph', text: 'Mở đầu' },
      { kind: 'heading', text: 'Bình úp' },
      { kind: 'paragraph', text: 'Dùng với cây nước.' },
      { kind: 'paragraph', text: '##không phải tiêu đề' },
    ])
  })

  it('returns nothing for a blank body', () => {
    expect(articleBlocks('  \n\n ')).toEqual([])
  })
})
