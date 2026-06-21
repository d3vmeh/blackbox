import { Highlight, type PrismTheme } from 'prism-react-renderer'

// Cool palette ONLY — violet/blue/cyan. Keeps the warm root/blast/pass hues
// reserved as semantic signals (DESIGN.md), so code never reads as a "signal".
const codeTheme: PrismTheme = {
  plain: { color: 'var(--text)', backgroundColor: 'transparent' },
  styles: [
    { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: 'var(--text-faint)', fontStyle: 'italic' } },
    { types: ['punctuation'], style: { color: 'var(--text-dim)' } },
    { types: ['keyword', 'operator', 'rule', 'important'], style: { color: '#A78BFA' } },
    { types: ['function', 'class-name', 'function-variable'], style: { color: '#7AA2F0' } },
    { types: ['string', 'char', 'attr-value', 'regex'], style: { color: '#5EC8D8' } },
    { types: ['number', 'boolean', 'constant'], style: { color: '#C4B5FD' } },
    { types: ['builtin', 'tag', 'symbol'], style: { color: '#7AA2F0' } },
    { types: ['variable', 'property', 'parameter'], style: { color: 'var(--text)' } },
  ],
}

export function CodeBlock({ code, language = 'python' }: { code: string; language?: string }) {
  const src = code.replace(/\s+$/, '') // drop trailing blank lines
  return (
    <Highlight theme={codeTheme} code={src} language={language}>
      {({ tokens, getLineProps, getTokenProps }) => (
        <pre className="cb">
          <code>
            {tokens.map((line, i) => {
              const lineProps = getLineProps({ line })
              return (
                <span key={i} {...lineProps} className={`cb__line ${lineProps.className ?? ''}`.trim()}>
                  <span className="cb__ln" aria-hidden="true">{i + 1}</span>
                  <span className="cb__src">
                    {line.map((token, k) => <span key={k} {...getTokenProps({ token })} />)}
                  </span>
                </span>
              )
            })}
          </code>
        </pre>
      )}
    </Highlight>
  )
}
