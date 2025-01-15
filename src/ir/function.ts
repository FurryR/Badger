// Early development, do not use IR for now.

import {
  BinaryExpressionNode,
  CallExpressionNode,
  ExpressionNode,
  ExpressionStatementNode,
  LiteralNode,
  NoopNode,
  VariableReferenceNode,
  type FunctionDeclarationNode
} from 'src/parser/ast'
import * as IR from './instruction'
import { Message, Warning } from 'src/parser/message'

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

class ExpressionRange {
  constructor(public start: number, public end: number) {}
}
export class IRFunction {
  public program: IR.Command[] = []
  // TODO: result type
  // TODO: generic parameter
  private _usedLocals: number = 0
  public messages: Message[] = []
  private _freeLocals: number[] = []
  private requireLocal(): IR.LocalVariable {
    return new IR.LocalVariable(this._freeLocals.pop() ?? this._usedLocals++)
  }
  private freeLocal(local: IR.LocalVariable) {
    if (!this._freeLocals.includes(local.index)) {
      this._freeLocals.push(local.index)
    }
  }
  get locals(): number {
    return this._usedLocals
  }
  private evaluate(expr: ExpressionNode): IR.Value | IR.Command[] {
    if (expr instanceof LiteralNode) {
      return new IR.Literal(parseLiteral(expr.value.value))
    } else if (expr instanceof BinaryExpressionNode) {
      const lhs = this.evaluate(expr.left)
      const rhs = this.evaluate(expr.right)
      const map = new Map([
        ['+', IR.Add],
        ['-', IR.Sub],
        ['*', IR.Mul],
        ['/', IR.Div],
        ['%', IR.Mod]
      ])
      const cmd = map.get(expr.operator.value)
      if (!cmd) throw new Error('Not implemented')
      if (lhs instanceof IR.Value && rhs instanceof IR.Value) {
        return [new cmd(lhs, rhs)]
      } else if (lhs instanceof IR.Value && Array.isArray(rhs)) {
        return [...rhs, new cmd(lhs, new IR.ReturnResult())]
      } else if (rhs instanceof IR.Value && Array.isArray(lhs)) {
        return [...lhs, new cmd(new IR.ReturnResult(), rhs)]
      } else if (Array.isArray(lhs) && Array.isArray(rhs)) {
        const lhsLocal = this.requireLocal()
        const code = [
          ...lhs,
          new IR.Assign(lhsLocal, new IR.ReturnResult()),
          ...rhs,
          new cmd(lhsLocal, new IR.ReturnResult())
        ]
        this.freeLocal(lhsLocal)
        return code
      }
      throw new Error('Unreachable')
    } else if (expr instanceof CallExpressionNode) {
      if (
        expr.callee instanceof VariableReferenceNode &&
        expr.callee.name.value === 'test'
      ) {
        const evaluateCmd = []
        const args: IR.Value[] = []
        const evaluated = expr.args.map(arg => this.evaluate(arg))
        for (const [index, arg] of evaluated.entries()) {
          if (arg instanceof IR.Value) {
            args.push(arg)
            continue
          } else if (
            evaluated.slice(index + 1).every(v => v instanceof IR.Value)
          ) {
            evaluateCmd.push(...arg)
            args.push(new IR.ReturnResult())
          } else {
            const local = this.requireLocal()
            evaluateCmd.push(
              ...arg,
              new IR.Assign(local, new IR.ReturnResult())
            )
            args.push(local)
          }
        }
        const result = [...evaluateCmd, new IR.Call('test', args)]
        for (const local of args) {
          if (local instanceof IR.LocalVariable) this.freeLocal(local)
        }
        return result
      } else {
        throw new Error('Not implemented')
      }
    }
    throw new Error('Not implemented')
  }
  private expressionRange(expr: ExpressionNode): ExpressionRange {
    if (expr instanceof LiteralNode) {
      return new ExpressionRange(expr.value.start, expr.value.end)
    } else if (expr instanceof BinaryExpressionNode) {
      // return [
      //   this.expressionRange(expr.left)[0],
      //   expr.right.value.end
      // ]
      return new ExpressionRange(
        this.expressionRange(expr.left).start,
        this.expressionRange(expr.right).end
      )
    } else if (expr instanceof CallExpressionNode) {
      return new ExpressionRange(
        this.expressionRange(expr.callee).start,
        this.expressionRange(expr.args[expr.args.length - 1]).end + 1
      )
    }
    throw new Error('Not implemented')
  }
  public parse() {
    // const scope = new Scope(
    //   parentScope ?? this.globalScope,
    //   this.requireLocal.bind(this),
    //   this.freeLocal.bind(this)
    // )
    for (const cmd of this.fn.body) {
      if (cmd instanceof NoopNode) continue
      if (cmd instanceof ExpressionStatementNode) {
        const v = this.evaluate(cmd.value)
        if (v instanceof IR.Value) {
          const range = this.expressionRange(cmd.value)
          this.messages.push(
            new Warning(range.start, range.end, 'Expression has no effect.')
          )
        } else {
          this.program.push(...v)
        }
      }
    }
    // scope.dispose()
  }
  toString() {
    return `fn ${this.fn.name.value}(${this.locals}) {\n${this.program
      .map(v => v.toString())
      .join('\n')}\n}`
  }
  constructor(
    // private globalScope: Scope,
    private fn: FunctionDeclarationNode
  ) {}
}
