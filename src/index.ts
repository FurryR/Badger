import { readFileSync, writeFileSync } from 'fs'
import { Lexer } from './parser/lexer'
import { Warning } from './parser/message'
import { Parser } from './parser/parser'

export * as Lexer from './parser/lexer'
export * as Parser from './parser/parser'
export * as AST from './parser/ast'
export * as Message from './parser/message'

// 示例代码
const code = readFileSync('./test.br').toString('utf-8')

export function getLine(
  text: string,
  startIndex: number,
  endIndex: number
): [number, number, number, number, string] {
  // 定义高亮的 ANSI 颜色码
  const highlightStart = '\x1b[31m' // 红色
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

  // 提取出选中的部分
  const selectedText = text.substring(startIndex, endIndex)

  // 用高亮的文本替换选中的部分
  const highlightedLine = lineText.replace(
    selectedText,
    `${highlightStart}${selectedText}${highlightEnd}`
  )

  return [startLine, startCol, endLine, endCol, highlightedLine]
}

// 词法分析
const lexer = new Lexer(code)
lexer.tokenize()
const parser = new Parser(lexer.tokens)
parser.parse()

for (const v of lexer.messages) {
  const line = getLine(code, v.start, v.end)
  ;(v instanceof Warning ? console.warn : console.error)(
    `./test.br:${line[0] + 1}:${line[1] + 1} - ./test.br:${line[2] + 1}:${
      line[3] + 1
    } ${v.message}`
  )
  console.group()
  console.log(line[4])
  console.groupEnd()
}
for (const v of parser.messages) {
  const line = getLine(code, v.start, v.end)
  ;(v instanceof Warning ? console.warn : console.error)(
    `./test.br:${line[0] + 1}:${line[1] + 1} - ./test.br:${line[2] + 1}:${
      line[3] + 1
    } ${v.message}`
  )
  console.group()
  console.log(line[4])
  console.groupEnd()
}

writeFileSync('./ast.json', JSON.stringify(parser.program, null, 2))
console.log(parser.program.toString())
