export abstract class Command {
  abstract toString(): string
}
export abstract class Value {
  abstract toString(): string
}
// export function parseVal(str: string): Value {
//   if (str === 'this') return new ThisVariable()
//   if (str === 'res') return new ReturnResult()
//   if (str.startsWith('g$')) return new GlobalVariable(str.substring(2))
//   if (str.startsWith('l$')) return new LocalVariable(str.substring(2))
//   if (str.startsWith('(extern ')) {
//     const [, code] = str.match(/\(extern (.*)\)/) ?? []
//     return new ExternalReporter(code)
//   }
//   return new Literal(JSON.parse(str))
// }

// export function splitStatements(input: string): string[] {
//   const statements: string[] = []
//   let currentStatement = ''
//   let braceCount = 0
//   let inString = false

//   for (let i = 0; i < input.length; i++) {
//     const char = input[i]
//     const prevChar = i > 0 ? input[i - 1] : ''

//     // 检查字符串的开始和结束
//     if (char === '"' && prevChar !== '\\') {
//       inString = !inString // 切换字符串状态
//     }

//     // 处理大括号
//     if (char === '{' && !inString) {
//       braceCount++
//     } else if (char === '}' && !inString) {
//       braceCount--
//     }

//     // 处理分号
//     if (char === ';' && braceCount === 0 && !inString) {
//       statements.push(currentStatement.trim())
//       currentStatement = ''
//     } else {
//       currentStatement += char
//     }
//   }

//   // 添加最后一个语句（如果有）
//   if (currentStatement.trim()) {
//     statements.push(currentStatement.trim())
//   }

//   return statements
// }

// export function parseParameters(input: string): string[] {
//   const regex = /"(?:[^"\\]|\\.)*"|{[^}]*}|[^,\s]+/g
//   const matches = input.match(regex)
//   return matches ? matches.map(param => param.trim()) : []
// }

// export function parseRef(str: string): VarReference {
//   const ret = parseVal(str)
//   if (!(ret instanceof VarReference)) throw new Error('Invalid lvalue')
//   return ret
// }
// export function parseCmd(str: string): Command
// export function parseCmd(str: string[]): Command[]
// export function parseCmd(str: string | string[]): Command | Command[] {
//   if (Array.isArray(str)) return str.map(v => parseCmd(v))
//   const BINARY: Record<
//     string,
//     { new (lhs: Value, rhs: Value): BinaryOperation }
//   > = {
//     add: Addition,
//     sub: Subtract,
//     mul: Multiply,
//     div: Division,
//     mod: Modulus,
//     bitwise_and: BitwiseAnd,
//     bitwise_or: BitwiseOr,
//     and: LogicAnd,
//     or: LogicOr
//   }
//   const cmd = str.substring(0, str.indexOf(' '))
//   const args = parseParameters(str.substring(str.indexOf(' ') + 1))
//   if (cmd in Object.keys(BINARY)) {
//     return new BINARY[cmd](parseVal(args[0]), parseVal(args[1]))
//   }
//   if (cmd === 'mov') {
//     return new Assign(parseRef(args[0]), parseVal(args[1]))
//   }
//   if (cmd === 'call') {
//     return new Call(
//       args[0],
//       parseParameters(args[1].slice(1, -1)).map(parseVal)
//     )
//   }
//   if (cmd === 'if') {
//     return new If(
//       parseVal(args[0]),
//       parseCmd(splitStatements(args[1])),
//       args.length === 3 ? parseCmd(splitStatements(args[2])) : null
//     )
//   }
//   if (cmd === 'while') {
//     return new While(parseVal(args[0]), parseCmd(splitStatements(args[1])))
//   }
//   if (cmd === 'ret') {
//     return new Ret(args.length === 1 ? parseVal(args[0]) : null)
//   }

//   throw new Error('Invalid instruction')
// }
export abstract class VarReference extends Value {}
/**
 * Unsafe global variable.
 * You must use `lock_global` before using GlobalVariable in safe functions.
 */
export class GlobalVariable extends VarReference {
  constructor(public name: string) {
    super()
  }
  toString(): string {
    return `g$${this.name}`
  }
}

/**
 * Local variable.
 */
export class LocalVariable extends VarReference {
  constructor(public name: string) {
    super()
  }
  toString(): string {
    return `l$${this.name}`
  }
}

/**
 * Class instance. This register is writable in inline member functions.
 */
export class ThisVariable extends VarReference {
  constructor() {
    super()
  }
  toString(): string {
    return 'this'
  }
}
/**
 * The 'res' register used for many things.
 */
export class ReturnResult extends VarReference {
  constructor() {
    super()
  }
  toString(): string {
    return 'res'
  }
}
/**
 * Immutable function arguments.
 */
export class Argument extends Value {
  constructor(public index: number) {
    super()
  }
  toString(): string {
    return `a${this.index}`
  }
}
/**
 * Literal.
 */
export class Literal extends Value {
  constructor(public value: string | number) {
    super()
  }
  toString(): string {
    return JSON.stringify(this.value)
  }
}
/**
 * Assignment.
 *
 * Usage:
 *
 * ```
 * fn test(0) {
 *   mov res, 1
 *   ret res
 * }
 * ```
 */
export class Assign extends Command {
  constructor(public lhs: VarReference, public rhs: Value) {
    super()
  }
  toString(): string {
    return `mov ${this.lhs.toString()}, ${this.rhs.toString()}`
  }
}

export abstract class BinaryOperation extends Command {
  constructor(public lhs: Value, public rhs: Value) {
    super()
  }
  toString(): string {
    return `${this.lhs.toString()}, ${this.rhs.toString()}`
  }
}

export class Call extends Command {
  constructor(public callee: string, public args: Value[]) {
    super()
  }
  toString(): string {
    return `call ${this.callee}, (${this.args
      .map(v => v.toString())
      .join(', ')})`
  }
}
/**
 * External command. Used for IR intrinsics.
 *
 * Usage:
 *
 * ```
 * fn move_steps(1) { // fn move_steps(step: number) -> void
 *   extern "motion_movesteps(STEPS=arg0)"
 *   ret
 * }
 * ```
 */
export class ExternalCommand extends Command {
  constructor(public code: string) {
    super()
  }
  toString(): string {
    return `extern ${JSON.stringify(this.code)}`
  }
}

/**
 * External reporter. Used for IR intrinsics. The result is stored at 'res'.
 *
 * Usage:
 *
 * ```
 * fn yield(0) { // async fn yield() -> void
 *   drop (extern translate_getTranslate(input WORDS="1"))
 *   ret
 * }
 * ```
 */
export class ExternalReporter extends Value {
  constructor(public code: string) {
    super()
  }
  toString(): string {
    return `(extern ${JSON.stringify(this.code)})`
  }
}
/**
 * Perform addition. The result is stored at `res` register.
 *
 * Usage:
 *
 * ```
 * fn test(0) {
 *   add 1, 2
 *   ret res
 * }
 * ```
 */
export class Addition extends BinaryOperation {
  toString(): string {
    return `add ${this.lhs.toString()}, ${this.rhs.toString()}`
  }
}
export class Subtract extends BinaryOperation {
  toString(): string {
    return `sub ${super.toString()}`
  }
}
export class Multiply extends BinaryOperation {
  toString(): string {
    return `mul ${super.toString()}`
  }
}
export class Division extends BinaryOperation {
  toString(): string {
    return `div ${super.toString()}`
  }
}
export class Modulus extends BinaryOperation {
  toString(): string {
    return `mod ${super.toString()}`
  }
}
/**
 * Bitwise AND.
 *
 * Usage:
 *
 * ```
 * fn convert_to_32bit(1) {
 *   bitwise_and arg0, arg0
 *   ret res
 * }
 */
export class BitwiseAnd extends BinaryOperation {
  toString(): string {
    return `bitwise_and ${super.toString()}`
  }
}
export class BitwiseOr extends BinaryOperation {
  toString(): string {
    return `bitwise_or ${super.toString()}`
  }
}

export class LogicAnd extends BinaryOperation {
  toString(): string {
    return `and ${super.toString()}`
  }
}
export class LogicOr extends BinaryOperation {
  toString(): string {
    return `or ${super.toString()}`
  }
}
export class LogicLt extends BinaryOperation {
  toString(): string {
    return `lt ${super.toString()}`
  }
}
export class LogicGt extends BinaryOperation {
  toString(): string {
    return `gt ${super.toString()}`
  }
}
export class LogicEq extends BinaryOperation {
  toString(): string {
    return `eq ${super.toString()}`
  }
}

/**
 * If the specify register is `true`, then execute the branch.
 *
 * Usage:
 *
 * ```
 * fn is_true(1) { // fn is_true(value: boolean) -> string
 *   eq arg0, true
 *   if res, {
 *     ret "is true"
 *   }, {
 *     ret "is false"
 *   }
 * }
 * ```
 */
export class If extends Command {
  constructor(
    public condition: Value,
    public body: Command[],
    public alternate: Command[] | null
  ) {
    super()
  }
  toString(): string {
    return `if ${this.condition.toString()} {${this.body
      .map(v => v.toString() + ';')
      .join('')}}${
      this.alternate
        ? ` else {${this.alternate.map(v => v.toString() + ';').join('')}}`
        : ''
    }`
  }
}

/**
 * While loop.
 */
export class While extends Command {
  constructor(public condition: Value, public body: Command[]) {
    super()
  }
  toString(): string {
    return `while ${this.condition.toString()} {${this.body
      .map(v => v.toString() + ';')
      .join('')}}`
  }
}

/**
 * Return a value from function with specify value / register as result.
 * This operation also clears the used stack memory.
 *
 * Usage:
 *
 * ```
 * fn test(0) { // fn test() -> number
 *   ret 1
 * }
 * ```
 */
export class Ret extends Command {
  constructor(public res: Value | null) {
    super()
  }
  toString(): string {
    return `ret${this.res ? ' ' + this.res.toString() : ''}`
  }
}
