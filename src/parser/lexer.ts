import { Message, Warning, Error } from './message'

export abstract class Token {
  constructor(
    public type: TokenType,
    public value: string,
    public start: number,
    public end: number
  ) {}
}

export enum TokenType {
  Identifier = 'Identifier',
  Keyword = 'Keyword',
  Literal = 'Literal',
  Decorator = 'Decorator',
  Operator = 'Operator',
  Eol = 'Eol'
}

// 不同类型的 Token
export class IdentifierToken extends Token {
  constructor(value: string, start: number, end: number) {
    super(TokenType.Identifier, value, start, end)
  }
}

export class KeywordToken extends Token {
  constructor(value: string, start: number, end: number) {
    super(TokenType.Keyword, value, start, end)
  }
}

export class LiteralToken extends Token {
  constructor(value: string, start: number, end: number) {
    super(TokenType.Literal, value, start, end)
  }
}

export class DecoratorToken extends Token {
  constructor(value: string, start: number, end: number) {
    super(TokenType.Decorator, value, start, end)
  }
}

export class OperatorToken extends Token {
  constructor(value: string, start: number, end: number) {
    super(TokenType.Operator, value, start, end)
  }
}

export class EolToken extends Token {
  constructor(value: string, start: number, end: number) {
    super(TokenType.Eol, value, start, end)
  }
}

// 词法分析器
export class Lexer {
  private position: number = 0
  public tokens: Token[] = []
  public messages: Message[] = []

  constructor(private input: string) {}

  private isWhitespace(char: string): boolean {
    return /\s/.test(char)
  }

  private isIdentifierStart(char: string): boolean {
    return /[a-zA-Z_$]/.test(char)
  }

  private isIdentifierPart(char: string): boolean {
    return /[a-zA-Z0-9_$]/.test(char)
  }

  private isHex(char: string): boolean {
    return /[a-fA-F0-9]/.test(char)
  }

  private isOctal(char: string): boolean {
    return /[0-7]/.test(char)
  }

  private isDigit(char: string): boolean {
    return /\d/.test(char)
  }

  private isOperator(char: string): boolean {
    return [
      '+',
      ',',
      '.',
      '{',
      '}',
      '[',
      ']',
      '-',
      '*',
      '/',
      '%',
      '>',
      '<',
      '=',
      '&',
      '|',
      '^',
      '!',
      '~',
      '?',
      ':',
      '(',
      ')',
      '||',
      '&&',
      '>>',
      '->',
      '=>',
      '<<',
      '+=',
      '++',
      '**',
      '--',
      '-=',
      '*=',
      '**=',
      '/=',
      '^=',
      '&=',
      '|=',
      '%=',
      '>=',
      '<=',
      '==',
      '!=',
      '>>>',
      '>>=',
      '<<=',
      '&&=',
      '||=',
      '>>>='
    ].includes(char)
  }

  private isKeyword(id: string): boolean {
    return [
      'class',
      'return',
      'as',
      'let',
      'const',
      'export',
      'import',
      'fn',
      'extends',
      'do',
      'while',
      'for',
      'loop',
      'if',
      'else',
      'match',
      'break',
      'continue',
      'with',
      'pub',
      'macro',
      'inline',
      'intrinsic',
      'static',
      'unsafe',
      'async',
      'await'
    ].includes(id)
  }

  private nextChar(): string {
    return this.input[this.position++]
  }

  private peekChar(): string {
    return this.input[this.position]
  }

  private _nextString(quote: string): string {
    let str = quote // 包含开头的引号
    while (this.position < this.input.length) {
      const char = this.nextChar()
      if (char === quote) {
        str += char // 包含结尾的引号
        return str
      }
      if (char === '\n' && quote !== '`') {
        this.messages.push(
          new Error(this.position, this.position, 'Unexpected end of input.')
        )
        return str
      }
      if (char === '\\') {
        str += char
        const nextChar = this.nextChar()
        switch (nextChar) {
          case '"':
          case "'":
          case '`': {
            if (nextChar !== quote) {
              this.messages.push(
                new Warning(
                  this.position - 1,
                  this.position,
                  'Unnecessary escape character.'
                )
              )
            }
            str += nextChar
            break
          }
          case 'n': {
            str += '\\n'
            break
          }
          case 't': {
            str += '\\t'
            break
          }
          case 'r': {
            str += '\\r'
            break
          }
          case 'b': {
            str += '\\b'
            break
          }
          case 'f': {
            str += '\\f'
            break
          }
          case 'v': {
            str += '\\x0B'
            break
          }
          case '0': {
            str += '\\0'
            break
          }
          case 'x': {
            const startPosition = this.position
            let idx = 0
            let hex = ''
            while (idx++ !== 2) {
              const curr = (hex += this.nextChar())
              if (!this.isHex(curr)) {
                this.messages.push(
                  new Warning(
                    startPosition,
                    this.position,
                    'Unknown hex character.'
                  )
                )
                break
              }
            }
            const code = parseInt(hex, 16)
            if (isNaN(code)) {
              break
            }
            str += `\\x${hex}`
            break
          }
          case 'u': {
            const startPosition = this.position
            let idx = 0
            let hex = ''
            while (idx++ !== 4) {
              const curr = (hex += this.nextChar())
              if (!this.isHex(curr)) {
                this.messages.push(
                  new Warning(
                    startPosition,
                    this.position,
                    'Unknown Unicode character.'
                  )
                )
                break
              }
            }
            const code = parseInt(hex, 16)
            if (isNaN(code)) {
              break
            }
            str += `\\u${hex}`
            break
          }
          default: {
            this.messages.push(
              new Warning(
                this.position - 1,
                this.position,
                'Unknown escape sequence.'
              )
            )
            str += nextChar // 其他字符直接添加
            break
          }
        }
      } else {
        str += char
      }
    }
    return str // 如果没有找到结束引号，返回当前字符串
  }

  private _nextNumber(curr: string): string {
    let number = curr
    while (
      this.isDigit(this.peekChar()) ||
      this.isHex(this.peekChar()) ||
      this.isOctal(this.peekChar()) ||
      this.peekChar() === 'o' ||
      this.peekChar() === 'x'
    ) {
      const chr = this.nextChar()
      number += chr
      if (
        !(number.startsWith('0x') || number.startsWith('0o')) &&
        ['e', 'E'].includes(chr)
      ) {
        const sign =
          this.peekChar() === '+' || this.peekChar() === '-'
            ? this.nextChar()
            : ''
        let exponent = ''
        while (this.isDigit(this.peekChar())) {
          exponent += this.nextChar()
        }
        number += `${sign}${exponent}`
      } else this.nextChar()
    }
    return number
  }

  private skipSingleLineComment(): void {
    while (this.position < this.input.length && this.peekChar() !== '\n') {
      this.nextChar()
    }
    // 处理完单行注释后，继续到下一行
    if (this.position < this.input.length) {
      this.nextChar() // 跳过换行符
    }
  }

  private skipMultiLineComment(): void {
    while (this.position < this.input.length) {
      const char = this.nextChar()
      if (char === '*' && this.peekChar() === '/') {
        this.nextChar() // 跳过结束的斜杠
        return
      }
    }
    // 如果到达输入末尾仍未找到结束符，记录错误
    this.messages.push(
      new Error(
        this.position,
        this.position,
        'Unterminated multi-line comment.'
      )
    )
  }

  private nextLiteral(curr: string): string {
    if (this.isDigit(curr)) return this._nextNumber(curr)
    return this._nextString(curr)
  }

  private nextIdentifier(curr: string): string {
    let identifier = curr
    while (this.isIdentifierPart(this.peekChar())) {
      identifier += this.nextChar()
    }
    return identifier
  }

  private nextOperator(curr: string): string {
    let operator = curr
    while (
      this.isOperator(this.peekChar()) &&
      this.isOperator(operator + this.peekChar())
    ) {
      operator += this.nextChar()
    }
    return operator
  }

  private next(): void {
    const pos = this.position
    const char = this.nextChar()

    if (char === '/') {
      if (this.peekChar() === '/') {
        this.skipSingleLineComment()
        return
      } else if (this.peekChar() === '*') {
        this.nextChar() // 跳过 '*'
        this.skipMultiLineComment()
        return
      }
    }

    if (this.isWhitespace(char)) {
      return
    }

    if (this.isIdentifierStart(char)) {
      const id = this.nextIdentifier(char)
      this.tokens.push(
        this.isKeyword(id)
          ? new KeywordToken(id, pos, this.position)
          : new IdentifierToken(id, pos, this.position)
      )
      return
    }

    if (this.isDigit(char) || char === '"' || char === "'" || char === '`') {
      this.tokens.push(
        new LiteralToken(this.nextLiteral(char), pos, this.position)
      )
      return
    }

    if (char === '@') {
      this.tokens.push(new DecoratorToken(char, pos, this.position))
      return
    }

    if (char === ';' || char === '\n') {
      this.tokens.push(new EolToken(char, pos, this.position))
      return
    }

    if (this.isOperator(char)) {
      const v = this.nextOperator(char)
      this.tokens.push(new OperatorToken(v, pos, this.position))
      return
    }

    this.messages.push(new Error(pos, pos, `Unknown character '${char}'.`))
  }

  public tokenize() {
    while (this.position < this.input.length) {
      this.next()
    }
  }
}
