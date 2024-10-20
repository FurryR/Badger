import { IdentifierToken, LiteralToken, OperatorToken } from './lexer'

export abstract class ASTNode {
  abstract toString(): string
}
export class TypeAccessNode extends ASTNode {
  constructor(
    public object: IdentifierToken | TypeAccessNode,
    public property: IdentifierToken
  ) {
    super()
  }
  toString(): string {
    return `${
      this.object instanceof IdentifierToken
        ? this.object.value
        : this.object.toString()
    }.${this.property.value}`
  }
}
export class Type extends ASTNode {
  constructor(
    public type: IdentifierToken | TypeAccessNode,
    public genericTypes: Type[]
  ) {
    super()
  }
  toString(): string {
    return `${
      this.type instanceof IdentifierToken
        ? this.type.value
        : this.type.toString()
    }${
      this.genericTypes.length > 0
        ? `<${this.genericTypes.map(v => v.toString()).join(',')}>`
        : ''
    }`
  }
}

export class ProgramNode extends ASTNode {
  constructor(public statements: StatementNode[]) {
    super()
  }

  toString(): string {
    return this.statements
      .filter(v => v.type !== 'Noop')
      .map(v => v.toString() + ';')
      .join('')
  }
}

export abstract class StatementNode extends ASTNode {
  constructor(public type: string) {
    super()
  }
}

export class NoopNode extends StatementNode {
  constructor() {
    super('Noop')
  }
  toString(): string {
    return ''
  }
}

export class ExportNode extends StatementNode {
  constructor(
    public declaration:
      | VariableDeclarationNode
      | FunctionDeclarationNode
      | ClassDeclarationNode
      | MacroDeclarationNode
      | DecoratorNode
  ) {
    super('Export')
  }
  toString(): string {
    if (this.declaration instanceof DecoratorNode) {
      return `${this.declaration.toString(true)}`
    }
    return `export ${this.declaration.toString()}`
  }
}

export class IntrinsicNode extends StatementNode {
  constructor(public code: LiteralToken) {
    super('Intrinsic')
  }
  toString(): string {
    return `intrinsic ${this.code.value}`
  }
}

export class DecoratorNode extends StatementNode {
  constructor(
    public callee: IdentifierToken | TypeAccessNode,
    public args: ExpressionNode[],
    public declaration:
      | VariableDeclarationNode
      | FunctionDeclarationNode
      | ClassDeclarationNode
      | MacroDeclarationNode
      | DecoratorNode
  ) {
    super('Decorator')
  }
  toString(hasExport?: boolean): string {
    return `@${
      this.callee instanceof IdentifierToken
        ? this.callee.value
        : this.callee.toString()
    }${
      this.args.length === 0
        ? ''
        : '(' + this.args.map(v => v.toString()).join(',') + ')'
    } ${
      hasExport
        ? this.declaration instanceof DecoratorNode
          ? this.declaration.toString(true)
          : 'export ' + this.declaration.toString()
        : this.declaration.toString()
    }`
  }
}

export class ReturnNode extends StatementNode {
  constructor(public value: ExpressionNode) {
    super('Return')
  }
  toString(): string {
    return `return ${this.value.toString()}`
  }
}

export class BreakNode extends StatementNode {
  constructor() {
    super('Break')
  }
  toString(): string {
    return 'break'
  }
}

export class ContinueNode extends StatementNode {
  constructor() {
    super('Continue')
  }
  toString(): string {
    return 'break'
  }
}

export class WhileNode extends StatementNode {
  constructor(public condition: ExpressionNode, public body: StatementNode[]) {
    super('While')
  }
  toString(): string {
    return `while(${this.condition.toString()}){${this.body
      .filter(v => v.type !== 'Noop')
      .map(v => v.toString() + ';')
      .join('')}}`
  }
}

export class DoWhileNode extends StatementNode {
  constructor(public condition: ExpressionNode, public body: StatementNode[]) {
    super('DoWhile')
  }
  toString(): string {
    return `do{${this.body
      .filter(v => v.type !== 'Noop')
      .map(v => v.toString() + ';')
      .join('')}}while(${this.condition.toString()})`
  }
}

export class IfNode extends StatementNode {
  constructor(
    public condition: ExpressionNode,
    public body: StatementNode[],
    public alternate: StatementNode[] | null
  ) {
    super('If')
  }
  toString(): string {
    return `if(${this.condition.toString()}){${this.body
      .filter(v => v.type !== 'Noop')
      .map(v => v.toString() + ';')
      .join('')}}${
      this.alternate && this.alternate.length !== 0
        ? `else{${this.alternate.map(v => v.toString() + ';').join('')}}`
        : ''
    }`
  }
}

export class ForNode extends StatementNode {
  constructor(
    public first: StatementNode,
    public condition: ExpressionNode,
    public end: StatementNode,
    public body: StatementNode[]
  ) {
    super('For')
  }
  toString(): string {
    return `for(${this.first.toString()};${this.condition.toString()};${this.end.toString()}){${this.body
      .filter(v => v.type !== 'Noop')
      .map(v => v.toString() + ';')
      .join('')}}`
  }
}

export class LoopNode extends StatementNode {
  constructor(public body: StatementNode[]) {
    super('Loop')
  }
  toString(): string {
    return `loop{${this.body
      .filter(v => v.type !== 'Noop')
      .map(v => v.toString() + ';')
      .join('')}}`
  }
}

export interface MatchBranch {
  match: ExpressionNode
  body: StatementNode[]
}

export class MatchNode extends StatementNode {
  constructor(
    public value: ExpressionNode,
    public branches: MatchBranch[],
    public alternate: StatementNode[] | null
  ) {
    super('Match')
  }
  toString(): string {
    return `match(${this.value.toString()}){${this.branches.map(
      v =>
        `${v.match.toString()}=>{${v.body
          .filter(v => v.type !== 'Noop')
          .map(v => v.toString() + ';')
          .toString()}}`
    )}${
      this.alternate && this.alternate.length !== 0
        ? `_=>{${this.alternate
            .filter(v => v.type !== 'Noop')
            .map(v => v.toString() + ';')
            .join('')}}`
        : ''
    }}`
  }
}

export class ScopeNode extends StatementNode {
  constructor(public body: StatementNode[]) {
    super('Scope')
  }
  toString(): string {
    return `{${this.body
      .filter(v => v.type !== 'Noop')
      .map(v => v.toString() + ';')
      .join('')}}`
  }
}

export class MacroDeclarationNode extends StatementNode {
  constructor(public name: IdentifierToken, public code: LiteralToken) {
    super('MacroDeclaration')
  }
  toString(): string {
    return `macro ${this.name.value}=${this.code.value}`
  }
}

export interface ImportAlias {
  importName: IdentifierToken
  aliasName: IdentifierToken | null
}

export class ImportNode extends StatementNode {
  constructor(
    public importSource: LiteralToken,
    public importNames: ImportAlias[]
  ) {
    super('Import')
  }
  toString(): string {
    return `import {${this.importNames.map(v =>
      !v.aliasName
        ? `${v.importName.value}`
        : `${v.importName.value}:${v.aliasName.value}`
    )}} from ${this.importSource.value}`
  }
}

export class ImportDefaultNode extends StatementNode {
  constructor(public importSource: LiteralToken, public name: IdentifierToken) {
    super('ImportDefault')
  }
  toString(): string {
    return `import ${this.name.value} from ${this.importSource.value}`
  }
}

export class ClassDeclarationNode extends StatementNode {
  constructor(
    public name: IdentifierToken,
    public genericDeclaration: IdentifierToken[],
    public baseClass: Type | null,
    public methods: MethodDeclarationNode[]
  ) {
    super('ClassDeclaration')
  }
  toString(): string {
    return `class ${this.name.value}${
      this.genericDeclaration.length > 0
        ? `<${this.genericDeclaration.map(v => v.value).join(',')}>`
        : ''
    }${
      this.baseClass ? ` extends ${this.baseClass.toString()}` : ''
    }{${this.methods.map(v => v.toString()).join('')}}`
  }
}

export class FunctionDeclarationNode extends StatementNode {
  constructor(
    public name: IdentifierToken,
    public genericDeclaration: IdentifierToken[],
    public parameters: ParameterNode[],
    public returnType: Type,
    public isAsync: boolean,
    public isUnsafe: boolean,
    public isInline: boolean,
    public body: StatementNode[]
  ) {
    super('FunctionDeclaration')
  }
  toString(): string {
    return `${this.isUnsafe ? 'unsafe ' : ''}${this.isInline ? 'inline ' : ''}${
      this.isAsync ? 'async ' : ''
    }fn ${this.name.value}${
      this.genericDeclaration.length > 0
        ? `<${this.genericDeclaration.map(v => v.value).join(',')}>`
        : ''
    }(${this.parameters
      .map(v => v.toString())
      .join(',')})->${this.returnType.toString()}{${this.body
      .filter(v => v.type !== 'Noop')
      .map(v => v.toString() + ';')
      .join('')}}`
  }
}

export class MethodDeclarationNode extends ASTNode {
  constructor(
    public name: IdentifierToken,
    public genericDeclaration: IdentifierToken[],
    public parameters: ParameterNode[],
    public returnType: Type,
    public isAsync: boolean,
    public isStatic: boolean,
    public isPublic: boolean,
    public isUnsafe: boolean,
    public isInline: boolean,
    public body: StatementNode[]
  ) {
    super()
  }
  toString(): string {
    return `${this.isUnsafe ? 'unsafe ' : ''}${this.isStatic ? 'static ' : ''}${
      this.isInline ? 'inline ' : ''
    }${this.isAsync ? 'async ' : ''}${this.name.value}${
      this.genericDeclaration.length > 0
        ? `<${this.genericDeclaration.map(v => v.value).join(',')}>`
        : ''
    }(${this.parameters
      .map(v => v.toString())
      .join(',')})->${this.returnType.toString()}{${this.body
      .filter(v => v.type !== 'Noop')
      .map(v => v.toString() + ';')
      .join('')}}`
  }
}

export class ParameterNode extends ASTNode {
  constructor(
    public name: IdentifierToken,
    public paramType: Type | null,
    public defaultValue: ExpressionNode | null
  ) {
    super()
  }
  toString(): string {
    return `${this.name.value}${
      this.paramType ? `:${this.paramType.toString()}` : ''
    }${this.defaultValue ? `=${this.defaultValue.toString()}` : ''}`
  }
}

export interface VariableDefinition {
  name: IdentifierToken
  type: Type | null
  value: ExpressionNode
}
export class VariableDeclarationNode extends StatementNode {
  constructor(
    public definitions: VariableDefinition[],
    public isMutable: boolean
  ) {
    super('VariableDeclaration')
  }
  toString(): string {
    return `${this.isMutable ? 'let' : 'const'} ${this.definitions
      .map(
        v =>
          `${v.name.value}${
            v.type ? `:${v.type.toString()}` : ''
          }=${v.value.toString()}`
      )
      .join(',')}`
  }
}

export abstract class ExpressionNode extends ASTNode {}

export class BinaryExpressionNode extends ExpressionNode {
  constructor(
    public left: ExpressionNode,
    public operator: OperatorToken,
    public right: ExpressionNode
  ) {
    super()
  }
  toString(): string {
    return `(${this.left.toString()})${
      this.operator.value
    }(${this.right.toString()})`
  }
}

export class ConditionalExpressionNode extends ExpressionNode {
  constructor(
    public condition: ExpressionNode,
    public value: ExpressionNode,
    public alternate: ExpressionNode
  ) {
    super()
  }
  toString(): string {
    return `(${
      this.condition
    })?(${this.value.toString()}):(${this.alternate.toString()})`
  }
}

export class TypeCastExpressionNode extends ExpressionNode {
  constructor(public left: ExpressionNode, public type: Type) {
    super()
  }
  toString(): string {
    return `(${this.left.toString()}) as ${this.type.toString()}`
  }
}

export class PrefixUnaryExpressionNode extends ExpressionNode {
  constructor(public operator: OperatorToken, public right: ExpressionNode) {
    super()
  }
  toString(): string {
    return `${
      this.operator.value === 'await' ? 'await ' : this.operator.value
    }${this.right.toString()}`
  }
}

export class PostfixUnaryExpressionNode extends ExpressionNode {
  constructor(public operator: OperatorToken, public left: ExpressionNode) {
    super()
  }
  toString(): string {
    return `${this.left.toString()}${this.operator.value}`
  }
}

export class MemberAccessNode extends ExpressionNode {
  constructor(public object: ExpressionNode, public property: IdentifierToken) {
    super()
  }
  toString(): string {
    return `${this.object.toString()}.${this.property.value}`
  }
}

export class CallExpressionNode extends ExpressionNode {
  constructor(
    public callee: ExpressionNode,
    public genericParameter: Type[],
    public args: ExpressionNode[]
  ) {
    super()
  }
  toString(): string {
    return `${this.callee.toString()}(${this.args
      .map(v => v.toString())
      .join(',')})`
  }
}

export class VariableReferenceNode extends ExpressionNode {
  constructor(public name: IdentifierToken) {
    super()
  }
  toString(): string {
    return this.name.value
  }
}

export class LiteralNode extends ExpressionNode {
  constructor(public value: LiteralToken) {
    super()
  }
  toString(): string {
    return this.value.value
  }
}

export class ExpressionStatementNode extends StatementNode {
  constructor(public value: ExpressionNode) {
    super('ExpressionStatement')
  }
  toString(): string {
    return this.value.toString()
  }
}
