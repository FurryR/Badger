import {
  NoopNode,
  type FunctionDeclarationNode
} from 'src/parser/ast'
import * as IR from './instruction'

export function parseLiteral(literal: string): string | number {
  if (/\d/.test(literal[0])) {
    if (literal.startsWith('0x')) return parseInt(literal, 16)
    if (literal.startsWith('0o')) return parseInt(literal, 8)
    return parseFloat(literal[0])
  }
  let str = '' // 包含开头的引号
  let position = 1
  while (position < literal.length) {
    const char = literal[position++]
    if (char === literal) {
      str += char // 包含结尾的引号
      return str
    }
    if (char === '\n' && literal[0] !== '`') {
      return str
    }
    if (char === '\\') {
      const nextChar = literal[position++]
      switch (nextChar) {
        case '"':
        case "'":
        case '`': {
          str += nextChar
          break
        }
        case 'n': {
          str += '\n'
          break
        }
        case 't': {
          str += '\t'
          break
        }
        case 'r': {
          str += '\r'
          break
        }
        case 'b': {
          str += '\b'
          break
        }
        case 'f': {
          str += '\f'
          break
        }
        case 'v': {
          str += '\x0B'
          break
        }
        case '0': {
          str += '\0'
          break
        }
        case 'x': {
          let idx = 0
          let hex = ''
          while (idx++ !== 2) {
            hex += literal[position++]
          }
          const code = parseInt(hex, 16)
          if (isNaN(code)) {
            break
          }
          str += String.fromCodePoint(code)
          break
        }
        case 'u': {
          let idx = 0
          let hex = ''
          while (idx++ !== 4) {
            hex += literal[position++]
          }
          const code = parseInt(hex, 16)
          if (isNaN(code)) {
            break
          }
          str += String.fromCodePoint(code)
          break
        }
        default: {
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

export class Scope {
  private map = new Map<string, number>()
  get(name: string): IR.GlobalVariable | IR.LocalVariable | null {
    const v = this.map.get(name)
    if (v !== undefined)
      return this.parent
        ? new IR.LocalVariable(name)
        : new IR.GlobalVariable(name)
    if (this.parent) return this.parent.get(name)
    return null
  }
  create(name: string): IR.GlobalVariable | IR.LocalVariable {
    if (this.map.has(name))
      throw new Error(`Already defined ${name} in this scope.`)
    const req = this.require()
    this.map.set(name, req)
    return this.parent
      ? new IR.LocalVariable(name)
      : new IR.GlobalVariable(name)
  }
  dispose() {
    for (const v of this.map.values()) {
      this.free(v)
    }
  }
  constructor(
    public parent: Scope | null,
    private require: () => number,
    private free: (local: number) => void
  ) {}
}
export class IRFunction {
  public program: IR.Command[] = []
  private _usedLocals: number = 0
  private _freeLocals: number[] = []
  private requireLocal(): number {
    return this._freeLocals.pop() ?? this._usedLocals++
  }
  private freeLocal(local: number) {
    if (!this._freeLocals.includes(local)) {
      this._freeLocals.push(local)
    }
  }
  public parse(parentScope?: Scope) {
    const scope = new Scope(
      parentScope ?? this.globalScope,
      this.requireLocal.bind(this),
      this.freeLocal.bind(this)
    )
    for (const cmd of this.fn.body) {
      if (cmd instanceof NoopNode) continue
    }
    scope.dispose()
  }
  constructor(
    private globalScope: Scope,
    private fn: FunctionDeclarationNode
  ) {}
}
