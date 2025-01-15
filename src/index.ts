// import { readFileSync, writeFileSync } from 'fs'
import { IRFunction } from './ir/function'
import { FunctionDeclarationNode } from './parser/ast'
import { Lexer } from './parser/lexer'
import { Message, Warning } from './parser/message'
import { Parser } from './parser/parser'

export * as Lexer from './parser/lexer'
export * as Parser from './parser/parser'
export * as AST from './parser/ast'
export * as Message from './parser/message'

// 示例代码
// const code = readFileSync('./test.br').toString('utf-8')

export function getLine(
  text: string,
  startIndex: number,
  endIndex: number
): [number, number, number, number, string] {
  // 定义高亮的 ANSI 颜色码
  const highlightStart = '\x1b[31;4m' // 红色和下划线
  const highlightEnd = '\x1b[0m' // 重置颜色

  // 确保索引在文本范围内
  if (startIndex < 0 || endIndex > text.length || startIndex > endIndex) {
    throw new Error('Invalid start or end index')
  }

  // 计算开始行和列
  const startLine = (text.slice(0, startIndex).match(/\n/g) || []).length
  const startCol = startIndex - (text.lastIndexOf('\n', startIndex - 1) + 1)

  // 计算结束行和列
  const endLine = (text.slice(0, endIndex).match(/\n/g) || []).length
  const endCol = endIndex - (text.lastIndexOf('\n', endIndex - 1) + 1)

  // 找到开始和结束索引对应的行
  const startLineIndex = text.lastIndexOf('\n', startIndex) + 1
  const endLineIndex = text.indexOf('\n', endIndex)

  // 如果没有找到换行符，使用文本的长度作为结束索引
  const lineEndIndex = endLineIndex === -1 ? text.length : endLineIndex

  // 提取出这一行的文本
  const lineText = text.substring(startLineIndex, lineEndIndex)

  // 用高亮的文本替换选中的部分
  const highlightedLine =
    lineText.substring(0, startCol) +
    highlightStart +
    lineText.substring(startCol, endCol) +
    highlightEnd +
    lineText.substring(endCol)

  return [startLine, startCol, endLine, endCol, highlightedLine]
}

function showMessages(messages: Message[]) {
  for (const v of messages) {
    const line = getLine(code, v.start, v.end)
    ;(v instanceof Warning ? console.warn : console.error)(
      `<input>:${line[0] + 1}:${line[1] + 1} - <input>:${line[2] + 1}:${
        line[3] + 1
      } ${v.message}`
    )
    console.group()
    console.log(line[4])
    console.groupEnd()
  }
}

// 词法分析
const code = `
fn main() -> void {
  test(1 / (2 + test() * test()) - 5, test(), 1);
}
`
const lexer = new Lexer(code)
lexer.tokenize()
const parser = new Parser(lexer.tokens)
parser.parse()

showMessages(lexer.messages)
showMessages(parser.messages)

// writeFileSync('./ast.json', JSON.stringify(parser.program, null, 2))
console.log(code)
const fn = parser.program.statements[0] as FunctionDeclarationNode
const ir = new IRFunction(fn)
ir.parse()
showMessages(ir.messages)
console.log(ir.toString())

// console.log(parser.program.toString())
