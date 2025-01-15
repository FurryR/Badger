import {
  ProgramNode,
  StatementNode,
  ContinueNode,
  BreakNode,
  NoopNode,
  ExpressionStatementNode,
  ScopeNode,
  MacroDeclarationNode,
  IfNode,
  DoWhileNode,
  MatchNode,
  MatchBranch,
  WhileNode,
  LoopNode,
  ForNode,
  ClassDeclarationNode,
  MethodDeclarationNode,
  ExportNode,
  ImportNode,
  ImportDefaultNode,
  VariableDeclarationNode,
  VariableDefinition,
  DecoratorNode,
  ExpressionNode,
  ReturnNode,
  ParameterNode,
  FunctionDeclarationNode,
  BinaryExpressionNode,
  ConditionalExpressionNode,
  IntrinsicNode,
  PrefixUnaryExpressionNode,
  CallExpressionNode,
  MemberAccessNode,
  Type,
  VariableReferenceNode,
  LiteralNode,
  TypeCastExpressionNode,
  type ImportAlias,
  TypeAccessNode
} from './ast'
import {
  IdentifierToken,
  Token,
  OperatorToken,
  TokenType,
  EolToken,
  LiteralToken
} from './lexer'

import { Message, Error } from './message'

export class Parser {
  private current: number = 0
  public messages: Message[] = []
  public program: ProgramNode = new ProgramNode([])

  constructor(private tokens: Token[]) {}

  parse() {
    while (!this.isEof()) {
      this.program.statements.push(this.statement())
    }
  }

  private statement(): StatementNode {
    if (this.matchKeyword('import')) {
      return this.importStatement()
    } else if (this.matchKeyword('class')) {
      return this.classDeclaration()
    } else if (this.matchKeyword('let', 'const')) {
      return this.variableDeclaration()
    } else if (this.matchKeyword('fn', 'async', 'unsafe', 'inline')) {
      return this.functionDeclaration()
    } else if (this.matchKeyword('return')) {
      return this.returnStatement()
    } else if (this.matchKeyword('export')) {
      return this.exportStatement()
    } else if (this.matchKeyword('if')) {
      return this.ifStatement()
    } else if (this.matchKeyword('do')) {
      return this.doWhileStatement()
    } else if (this.matchKeyword('while')) {
      return this.whileStatement()
    } else if (this.matchKeyword('match')) {
      return this.switchStatement()
    } else if (this.matchKeyword('for')) {
      return this.forStatement()
    } else if (this.matchKeyword('loop')) {
      return this.loopStatement()
    } else if (this.matchKeyword('intrinsic')) {
      return this.intrisicStatement()
    } else if (this.matchKeyword('continue')) {
      return new ContinueNode()
    } else if (this.matchKeyword('break')) {
      return new BreakNode()
    } else if (this.matchKeyword('macro')) {
      return this.macroStatement()
    } else if (this.matchOperator('{')) {
      return this.scopeStatement()
    } else if (this.match(TokenType.Decorator)) {
      return this.decoratorStatement()
    } else if (this.match(TokenType.Eol)) {
      return new NoopNode()
    } else if (
      this.check(TokenType.Identifier, TokenType.Operator) ||
      this.check(TokenType.Literal) ||
      this.checkKeyword('await')
    ) {
      return new ExpressionStatementNode(this.expression())
    }
    const v = this.peek()
    this.messages.push(
      new Error(
        v.start,
        v.end,
        `Unexpected token '${v.value}' (lexer type '${v.type}').`
      )
    )
    this.current++
    return new NoopNode()
  }

  private scopeStatement(): ScopeNode {
    const body: StatementNode[] = []
    while (!this.checkOperator('}') && !this.isEof()) {
      body.push(this.statement())
    }
    this.consumeOperator('}', "Expect '}' to end scope body.")
    return new ScopeNode(body)
  }

  private macroStatement(): MacroDeclarationNode {
    const name = this.consume(TokenType.Identifier, 'Expect a macro name.')
    this.consumeOperator('=', "Expect '=' before macro definition.")
    const code = this.consume(TokenType.Literal, 'Expect marco definition.')
    return new MacroDeclarationNode(name, code)
  }

  private ifStatement(): IfNode {
    this.consumeOperator('(', "Expect '(' to start condition.")
    const condition = this.expression()
    this.consumeOperator(')', "Expect ')' to end condition.")
    const body: StatementNode[] = []
    let alternate: StatementNode[] | null = null
    if (this.matchOperator('{')) {
      while (!this.checkOperator('}') && !this.isEof()) {
        body.push(this.statement())
      }
      this.consumeOperator('}', "Expect '}' to end if body.")
    } else if (this.peek().type === 'Eol' && this.peek().value === '\n') {
      this.messages.push(
        new Error(this.peek().start, this.peek().end, 'Unexpected end of line.')
      )
    } else {
      body.push(this.statement())
    }
    if (this.matchKeyword('else')) {
      alternate = []
      if (this.matchOperator('{')) {
        while (!this.checkOperator('}') && !this.isEof()) {
          alternate.push(this.statement())
        }
        this.consumeOperator('}', "Expect '}' to end else body.")
      } else if (this.peek().type === 'Eol' && this.peek().value === '\n') {
        this.messages.push(
          new Error(
            this.peek().start,
            this.peek().end,
            'Unexpected end of line.'
          )
        )
      } else {
        alternate.push(this.statement())
      }
    }
    return new IfNode(condition, body, alternate)
  }

  private doWhileStatement(): DoWhileNode {
    const body: StatementNode[] = []
    if (this.matchOperator('{')) {
      while (!this.checkOperator('}') && !this.isEof()) {
        body.push(this.statement())
      }
      this.consumeOperator('}', "Expect '}' to end do-while body.")
    } else if (this.peek().type === 'Eol' && this.peek().value === '\n') {
      this.messages.push(
        new Error(this.peek().start, this.peek().end, 'Unexpected end of line.')
      )
    } else {
      body.push(this.statement())
    }
    this.consumeKeyword('while', "Expect 'while' keyword.")
    this.consumeOperator('(', "Expect '(' after while.")
    const condition = this.expression()
    this.consumeOperator(')', "Expect ')' to end condition.")
    return new DoWhileNode(condition, body)
  }

  private switchStatement(): MatchNode {
    this.consumeOperator('(', "Expect '(' after match.")
    const value = this.expression()
    this.consumeOperator(')', "Expect ')' after value.")
    const branches: MatchBranch[] = []
    let alternate: StatementNode[] | null = null
    this.consumeOperator('{', "Expect '{' to start branch.")
    while (!this.checkOperator('}') && !this.isEof()) {
      if (this.matchIdentifier('_')) {
        const token = this.previous()
        this.consumeOperator('=>', "Expect '=>' before default branch body.")
        const alreadyDefined = alternate !== null
        alternate = []
        if (this.matchOperator('{')) {
          while (!this.checkOperator('}') && !this.isEof()) {
            alternate.push(this.statement())
          }
          this.consumeOperator('}', "Expect '}' to end match branch body.")
        } else if (this.peek().type === 'Eol' && this.peek().value === '\n') {
          this.messages.push(
            new Error(
              this.peek().start,
              this.peek().end,
              'Unexpected end of line.'
            )
          )
        } else {
          alternate.push(this.statement())
        }
        if (alreadyDefined) {
          this.messages.push(
            new Error(token.start, token.end, 'Already defined default branch.')
          )
        }
      } else {
        const matchedExpression = this.expression(true)
        this.consumeOperator('=>', "Expect '=>' before match branch body.")
        const body: StatementNode[] = []
        if (this.matchOperator('{')) {
          while (!this.checkOperator('}') && !this.isEof()) {
            body.push(this.statement())
          }
          this.consumeOperator('}', "Expect '}' to end match branch body.")
        } else if (this.peek().type === 'Eol' && this.peek().value === '\n') {
          this.messages.push(
            new Error(
              this.peek().start,
              this.peek().end,
              'Unexpected end of line.'
            )
          )
        } else {
          body.push(this.statement())
        }
        branches.push({ match: matchedExpression, body })
      }
    }
    this.consumeOperator('}', "Expect '}' to end match branch.")
    return new MatchNode(value, branches, alternate)
  }

  private intrisicStatement(): IntrinsicNode {
    const a = this.consume(
      TokenType.Literal,
      'Expect a literal after intrinsic.'
    )
    return new IntrinsicNode(a)
  }

  private whileStatement(): DoWhileNode {
    const body: StatementNode[] = []
    this.consumeOperator('(', "Expect '(' after do.")
    const condition = this.expression()
    this.consumeOperator(')', "Expect ')' to end condition.")
    if (this.matchOperator('{')) {
      while (!this.checkOperator('}') && !this.isEof()) {
        body.push(this.statement())
      }
      this.consumeOperator('}', "Expect '}' to end do-while body.")
    } else if (this.peek().type === 'Eol' && this.peek().value === '\n') {
      this.messages.push(
        new Error(this.peek().start, this.peek().end, 'Unexpected end of line.')
      )
    } else {
      body.push(this.statement())
    }
    return new WhileNode(condition, body)
  }

  private loopStatement(): LoopNode {
    const body: StatementNode[] = []
    if (this.matchOperator('{')) {
      while (!this.checkOperator('}') && !this.isEof()) {
        body.push(this.statement())
      }
      this.consumeOperator('}', "Expect '}' to end loop body.")
    } else if (this.peek().type === 'Eol' && this.peek().value === '\n') {
      this.messages.push(
        new Error(this.peek().start, this.peek().end, 'Unexpected end of line.')
      )
    } else {
      body.push(this.statement())
    }
    return new LoopNode(body)
  }

  private forStatement(): ForNode {
    this.consumeOperator('(', "Expect '(' after for.")
    const first = this.statement()
    this.consumeEol(';', 'Expect a semi after first statement.')
    const condition = this.expression()
    this.consumeEol(';', 'Expect a semi after condition.')
    const end = this.statement()
    this.consumeOperator(')', "Expect ')' after condition.")
    const body: StatementNode[] = []
    if (this.matchOperator('{')) {
      while (!this.checkOperator('}') && !this.isEof()) {
        body.push(this.statement())
      }
      this.consumeOperator('}', "Expect '}' to end for body.")
    } else if (this.peek().type === 'Eol' && this.peek().value === '\n') {
      this.messages.push(
        new Error(this.peek().start, this.peek().end, 'Unexpected end of line.')
      )
    } else {
      body.push(this.statement())
    }
    return new ForNode(first, condition, end, body)
  }

  private classDeclaration(): ClassDeclarationNode {
    const name = this.consume(TokenType.Identifier, 'Expect class name.')
    let genericDeclaration: IdentifierToken[] = []
    if (this.matchOperator('<')) {
      genericDeclaration = this.genericDeclaration()
    }
    const methods: MethodDeclarationNode[] = []
    let baseClass: Type | null = null
    if (this.matchKeyword('extends')) {
      baseClass = this.consumeType('Expect base class name.')
    }
    this.consumeOperator('{', "Expect '{' to start class declarations.")
    while (!this.checkOperator('}') && !this.isEof()) {
      const state = new Map<string, boolean>()
      while (this.matchKeyword('unsafe', 'static', 'pub', 'inline')) {
        const token = this.previous()
        if (state.get(token.value))
          this.messages.push(
            new Error(
              token.start,
              token.end,
              `Already used '${token.value}' for this function.`
            )
          )
        state.set(token.value, true)
      }

      if (this.matchKeyword('async')) {
        state.set('async', true)
      }

      const name = this.consume(TokenType.Identifier, 'Expect method name.')
      let genericDeclaration: IdentifierToken[] = []
      if (this.matchOperator('<')) {
        genericDeclaration = this.genericDeclaration()
      }
      const parameters = this.functionParameters()
      this.consumeOperator('->', "Expect '->' after parameters.")
      const returnType = this.consumeType('Expect return type.')
      this.consumeOperator('{', "Expect '{' to start method body.")
      const body: StatementNode[] = []
      while (!this.checkOperator('}') && !this.isEof()) {
        body.push(this.statement())
      }
      this.consumeOperator('}', "Expect '}' to end method body.")
      methods.push(
        new MethodDeclarationNode(
          name,
          genericDeclaration,
          parameters,
          returnType,
          !!state.get('async'),
          !!state.get('static'),
          !!state.get('pub'),
          !!state.get('unsafe'),
          !!state.get('inline'),
          body
        )
      )
    }
    this.consumeOperator('}', "Expect '}' to end class declarations.")
    return new ClassDeclarationNode(
      name,
      genericDeclaration,
      baseClass,
      methods
    )
  }

  private exportStatement(): ExportNode | NoopNode {
    if (this.matchKeyword('let', 'const')) {
      return new ExportNode(this.variableDeclaration())
    } else if (this.matchKeyword('unsafe', 'inline', 'async', 'fn')) {
      return new ExportNode(this.functionDeclaration())
    } else if (this.matchKeyword('class')) {
      return new ExportNode(this.classDeclaration())
    } else if (this.matchKeyword('macro')) {
      return new ExportNode(this.macroStatement())
    }
    this.messages.push(
      new Error(
        this.peek().start,
        this.peek().end,
        `Unexpected token '${this.peek().value}' after 'export'.`
      )
    )
    return new NoopNode()
  }

  private importStatement(): ImportNode | ImportDefaultNode {
    if (this.matchOperator('{')) {
      const importNames: ImportAlias[] = []
      do {
        const name = this.consume(
          TokenType.Identifier,
          'Expect import member name.'
        )
        let alias: IdentifierToken | null = null
        if (this.matchOperator(':')) {
          alias = this.consume(
            TokenType.Identifier,
            'Expect import member alias.'
          )
        }
        if (
          importNames.some(
            v => (v.aliasName ?? v.importName).value === (alias ?? name).value
          )
        ) {
          const v = alias ?? name
          this.messages.push(
            new Error(v.start, v.end, `'${v.value}' reimported.`)
          )
        } else {
          importNames.push({
            importName: name,
            aliasName: alias
          })
        }
      } while (this.matchOperator(','))
      this.consumeOperator('}', "Expect '}' to end imports.")
      this.consumeIdentifier('from', "Expect 'from' for import source.")
      const importSource = this.consume(
        TokenType.Literal,
        'Expect import source.'
      )
      return new ImportNode(importSource, importNames)
    }
    const name = this.consume(TokenType.Identifier, 'Expect import name.')
    // non-keyword syntax
    this.consumeIdentifier('from', "Expect 'from' for import source.")
    const importSource = this.consume(
      TokenType.Literal,
      'Expect import source.'
    )
    return new ImportDefaultNode(importSource, name)
  }

  private variableDeclaration(): VariableDeclarationNode {
    const isMutable = this.previous().value === 'let'
    const definitions: VariableDefinition[] = []
    do {
      const name = this.consume(TokenType.Identifier, 'Expect variable name.')
      let paramType: Type | null = null
      if (this.matchOperator(':', "Expect ':' for variable type.")) {
        paramType = this.consumeType('Expect variable type.')
      }
      this.consumeOperator('=', "Expect '=' after variable name.")
      const value = this.expression(true)
      if (definitions.some(v => v.name.value === name.value)) {
        this.messages.push(
          new Error(name.start, name.end, `'${name.value}' redefined.`)
        )
      } else
        definitions.push({
          name,
          type: paramType,
          value
        })
    } while (this.matchOperator(','))
    return new VariableDeclarationNode(definitions, isMutable)
  }

  private decoratorStatement(): DecoratorNode | ExportNode | NoopNode {
    let name: IdentifierToken | TypeAccessNode = this.consume(
      TokenType.Identifier,
      'Expect decorator name.'
    )
    while (this.matchOperator('.')) {
      name = new TypeAccessNode(
        name,
        this.consume(
          TokenType.Identifier,
          'Expect an identifier after member access.'
        )
      )
    }
    const args: ExpressionNode[] = []
    if (this.matchOperator('(')) {
      if (!this.checkOperator(')')) {
        do {
          args.push(this.expression())
        } while (
          this.matchOperator(',') &&
          !(this.isEol() && this.peek().value === ';')
        )
      }
      this.consumeOperator(')', "Expect ')' after parameters.")
    }
    if (this.matchKeyword('let', 'const')) {
      return new DecoratorNode(name, args, this.variableDeclaration())
    } else if (this.matchKeyword('unsafe', 'inline', 'async', 'fn')) {
      return new DecoratorNode(name, args, this.functionDeclaration())
    } else if (this.matchKeyword('class')) {
      return new DecoratorNode(name, args, this.classDeclaration())
    } else if (this.matchKeyword('export')) {
      const v = this.exportStatement()
      if (v instanceof NoopNode) {
        return v
      }
      return new ExportNode(new DecoratorNode(name, args, v.declaration))
    } else if (this.matchKeyword('macro')) {
      return new DecoratorNode(name, args, this.macroStatement())
    } else if (this.matchOperator('@')) {
      const v = this.decoratorStatement()
      if (v instanceof NoopNode) {
        return v
      }
      if (v instanceof ExportNode) {
        return new ExportNode(new DecoratorNode(name, args, v.declaration))
      }
      return new DecoratorNode(name, args, v)
    }
    this.messages.push(
      new Error(
        this.peek().start,
        this.peek().end,
        `Unexpected token '${this.peek().value}' after decorator.`
      )
    )
    return new NoopNode()
  }

  private returnStatement(): ReturnNode {
    const value = this.expression()
    return new ReturnNode(value)
  }

  private functionParameters(): ParameterNode[] {
    this.consumeOperator('(', "Expect '(' after function name.")

    const parameters: ParameterNode[] = []
    if (!this.checkOperator(')')) {
      do {
        const paramName = this.consume(
          TokenType.Identifier,
          'Expect parameter name.'
        )
        let paramType: Type | null = null
        if (this.matchOperator(':')) {
          paramType = this.consumeType('Expect parameter type.')
        }
        let defaultValue: ExpressionNode | null = null
        if (this.matchOperator('=')) {
          defaultValue = this.expression()
        }
        parameters.push(new ParameterNode(paramName, paramType, defaultValue))
      } while (
        this.matchOperator(',') &&
        !(this.isEol() && this.peek().value === ';')
      )
    }
    this.consumeOperator(')', "Expect ')' after parameters.")
    return parameters
  }

  private functionDeclaration(): FunctionDeclarationNode {
    const state = new Map<string, boolean>()
    this.current--
    while (this.matchKeyword('unsafe', 'static', 'inline')) {
      const token = this.previous()
      if (state.get(token.value))
        this.messages.push(
          new Error(
            token.start,
            token.end,
            `Already used '${token.value}' for this function.`
          )
        )
      state.set(token.value, true)
    }
    if (this.matchKeyword('async')) {
      state.set('async', true)
    }
    this.consumeKeyword('fn', "Expect 'fn' keyword.")
    const name = this.consume(TokenType.Identifier, 'Expect function name.')
    let genericDeclaration: IdentifierToken[] = []
    if (this.matchOperator('<')) {
      genericDeclaration = this.genericDeclaration()
    }
    const parameters = this.functionParameters()
    this.consumeOperator('->', "Expect '->' after parameters.")
    const returnType = this.consumeType('Expect return type.')

    this.consumeOperator('{', "Expect '{' to start function body.")
    const body: StatementNode[] = []
    while (!this.checkOperator('}') && !this.isEof()) {
      body.push(this.statement())
    }
    this.consumeOperator('}', "Expect '}' to end function body.")

    return new FunctionDeclarationNode(
      name,
      genericDeclaration,
      parameters,
      returnType,
      !!state.get('async'),
      !!state.get('unsafe'),
      !!state.get('inline'),
      body
    )
  }

  // Operator precedence comes from https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Operators/Operator_precedence.

  private expression(disallowCommas?: boolean): ExpressionNode {
    return disallowCommas
      ? this._expressionAssignment()
      : this._expressionComma()
  }

  private _expressionBinaryBase(
    next: (this: Parser) => ExpressionNode,
    ...op: string[]
  ): ExpressionNode {
    const lhs = next.call(this)

    if (this.matchOperator(...op)) {
      const operator = this.previous() as OperatorToken
      const rhs = this._expressionBinaryBase(next, ...op)
      return new BinaryExpressionNode(lhs, operator, rhs)
    }
    return lhs
  }

  // ,: 1
  private _expressionComma(): ExpressionNode {
    return this._expressionBinaryBase(this._expressionAssignment, ',')
  }

  // =: 2
  private _expressionAssignment(): ExpressionNode {
    return this._expressionBinaryBase(
      this._expressionConditional,
      '=',
      '+=',
      '-=',
      '**=',
      '*=',
      '/=',
      '%=',
      '<<=',
      '>>=',
      '>>>=',
      '&=',
      '^=',
      '|=',
      '&&=',
      '||='
    )
  }

  // ?:: 3
  private _expressionConditional(): ExpressionNode {
    const condition = this._expressionLogicOr()

    if (this.matchOperator('?')) {
      const value = this._expressionConditional()
      this.consumeOperator(':', "Expect ':' for 'else' clause.")
      const alternate = this._expressionConditional()
      return new ConditionalExpressionNode(condition, value, alternate)
    }

    return condition
  }

  // ||: 4
  private _expressionLogicOr(): ExpressionNode {
    return this._expressionBinaryBase(this._expressionLogicAnd, '||')
  }

  // &&: 5
  private _expressionLogicAnd(): ExpressionNode {
    return this._expressionBinaryBase(this._expressionBitwiseOr, '&&')
  }

  // |: 6
  private _expressionBitwiseOr(): ExpressionNode {
    return this._expressionBinaryBase(this._expressionBitwiseXor, '|')
  }

  // ^: 7
  private _expressionBitwiseXor(): ExpressionNode {
    return this._expressionBinaryBase(this._expressionBitwiseAnd, '^')
  }

  // &: 8
  private _expressionBitwiseAnd(): ExpressionNode {
    return this._expressionBinaryBase(this._expressionEquality, '&')
  }

  // ==: 9
  private _expressionEquality(): ExpressionNode {
    return this._expressionBinaryBase(this._expressionComparison, '==', '!=')
  }

  // >: 10
  private _expressionComparison(): ExpressionNode {
    return this._expressionBinaryBase(
      this._expressionBitwiseShift,
      '<',
      '<=',
      '>',
      '>='
    )
  }

  // <<: 11
  private _expressionBitwiseShift(): ExpressionNode {
    return this._expressionBinaryBase(this._expressionTerm, '<<', '>>', '>>>')
  }

  // +: 12
  private _expressionTerm(): ExpressionNode {
    return this._expressionBinaryBase(this._expressionFactor, '+', '-')
  }

  // *: 13
  private _expressionFactor(): ExpressionNode {
    return this._expressionBinaryBase(this._expressionExpo, '*', '/', '%')
  }

  // **: 14
  private _expressionExpo(): ExpressionNode {
    return this._expressionBinaryBase(this._expressionPrefix, '**')
  }

  // await, ++, --, +, -, ~, !: 15
  private _expressionPrefix(): ExpressionNode {
    if (
      this.matchKeyword('await') ||
      this.matchOperator('++', '--', '+', '-', '~', '!')
    ) {
      // await is treated as an operator here.
      const token = this.previous()
      const operator = new OperatorToken(token.value, token.start, token.end)
      const right = this._expressionPrefix()
      return new PrefixUnaryExpressionNode(operator, right)
    }
    return this._expressionPostfix()
  }

  // ++, -- (postfix): 16
  private _expressionPostfix(): ExpressionNode {
    const lhs = this._expressionCall()
    if (this.matchOperator('++', '--')) {
      const operator = this.previous() as OperatorToken
      return new PrefixUnaryExpressionNode(operator, lhs)
    }
    return lhs
  }

  // fn(): 17 (18 in JS)
  private _expressionCall(): ExpressionNode {
    let callee = this._expressionLiteral()

    while (!this.isEof()) {
      if (this.matchOperator('<', '(')) {
        let genericParameter: Type[] = []
        if (this.previous().value === '<') {
          genericParameter = this.genericParameter()
        }
        const args: ExpressionNode[] = []
        if (!this.checkOperator(')')) {
          do {
            args.push(this.expression(true))
          } while (this.matchOperator(','))
        }
        this.consumeOperator(')', "Expect ')' after arguments.")
        callee = new CallExpressionNode(callee, genericParameter, args)
      } else if (this.matchOperator('.')) {
        const property = this.consume(
          TokenType.Identifier,
          "Expect property name after '.'."
        )
        callee = new MemberAccessNode(callee, property)
      } else if (this.match(TokenType.Eol)) {
        if (this.previous().value === ';') break
      } else {
        break
      }
    }
    return callee
  }

  // (), literal, as: 18 (19 in JS)
  private _expressionLiteral(): ExpressionNode {
    let expr: ExpressionNode | null = null
    if (this.match(TokenType.Identifier)) {
      const token = this.previous() as IdentifierToken
      expr = new VariableReferenceNode(token)
    } else if (this.match(TokenType.Literal)) {
      const token = this.previous() as LiteralToken
      expr = new LiteralNode(token)
    } else if (this.matchOperator('(')) {
      expr = this.expression()
      this.consumeOperator(')', "Expect ')' after expression.")
    }
    if (expr && this.matchKeyword('as')) {
      const type = this.consumeType('Expect type for type casting.')
      return new TypeCastExpressionNode(expr, type)
    } else if (expr) return expr
    this.current++
    this.messages.push(
      this.isEof()
        ? new Error(
            this.previous().start,
            this.previous().end,
            'Unexpected end of file.'
          )
        : new Error(
            this.peek().start,
            this.peek().end,
            `Unexpected operator '${this.peek().value}'.`
          )
    )
    return new NoopNode()
  }

  private _consumeBase(type: TokenType, value: string, message: string): Token {
    const v = this.peek()
    if (this.isEol()) {
      this.messages.push(
        new Error(
          this.previous().start,
          this.previous().end,
          'Unexpected end of line.'
        )
      )
      return new EolToken('\n', this.previous().start, this.previous().end)
    }
    if (!this.check(type) || v.value !== value) {
      this.messages.push(new Error(v.start, v.end, message))
    }
    this.current++
    return v
  }

  private consumeKeyword(value: string, message: string): Token {
    return this._consumeBase(TokenType.Keyword, value, message)
  }

  private consumeOperator(value: string, message: string): Token {
    return this._consumeBase(TokenType.Operator, value, message)
  }

  private consumeEol(value: '\n' | ';', message: string): Token {
    return this._consumeBase(TokenType.Eol, value, message)
  }

  private consumeIdentifier(value: string, message: string): Token {
    return this._consumeBase(TokenType.Identifier, value, message)
  }
  private genericParameter(): Type[] {
    const genericTypes: Type[] = []
    while (!this.isEof()) {
      genericTypes.push(this.consumeType('Expect a generic parameter.'))
      if (!this.matchOperator(',')) break
    }
    this.consumeOperator('>', "Expect '>' to close generic parameters.")
    return genericTypes
  }

  private genericDeclaration(): IdentifierToken[] {
    const genericTypes: IdentifierToken[] = []
    while (!this.isEof()) {
      genericTypes.push(
        this.consume(TokenType.Identifier, 'Expect a generic parameter.')
      )
      if (!this.matchOperator(',')) break
    }
    this.consumeOperator('>', "Expect '>' to close generic declaration.")
    return genericTypes
  }

  private consumeType(message: string): Type {
    let tp: IdentifierToken | TypeAccessNode = this.consume(
      TokenType.Identifier,
      message
    )
    while (this.matchOperator('.')) {
      // MemberAccess
      tp = new TypeAccessNode(
        tp,
        this.consume(
          TokenType.Identifier,
          'Expect an identifier after member access.'
        )
      )
    }
    // Parameter
    return new Type(tp, this.matchOperator('<') ? this.genericParameter() : [])
  }

  private consume(type: TokenType, message: string): Token {
    const v = this.peek()
    if (this.isEol()) {
      this.messages.push(
        new Error(
          this.previous().start,
          this.previous().end,
          'Unexpected end of line.'
        )
      )
      return new EolToken('\n', this.previous().start, this.previous().end)
    }
    if (!this.check(type)) {
      this.messages.push(new Error(v.start, v.end, message))
    }
    this.current++
    return v
  }

  private _matchBase(type: TokenType, values: string[]): boolean {
    return !!(this._checkBase(type, values) && ++this.current)
  }

  private match(...types: TokenType[]): boolean {
    return !!(this.check(...types) && ++this.current)
  }

  private matchOperator(...values: string[]): boolean {
    return this._matchBase(TokenType.Operator, values)
  }

  private matchIdentifier(...values: string[]): boolean {
    return this._matchBase(TokenType.Identifier, values)
  }

  private matchKeyword(...values: string[]): boolean {
    return this._matchBase(TokenType.Keyword, values)
  }

  private _checkBase(type: TokenType, values: string[]): boolean {
    if (!this.check(type)) return false
    for (const value of values) {
      if (this.peek().value === value) {
        return true
      }
    }
    return false
  }

  private checkKeyword(...values: string[]): boolean {
    return this._checkBase(TokenType.Keyword, values)
  }

  private checkOperator(...values: string[]): boolean {
    return this._checkBase(TokenType.Operator, values)
  }

  private check(...types: TokenType[]): boolean {
    if (types.includes(TokenType.Eol) ? this.isEof() : this.isEol())
      return false
    for (const type of types) {
      if (this.peek().type === type) {
        return true
      }
    }
    return false
  }

  private isEof(): boolean {
    return this.current >= this.tokens.length
  }

  private isEol(): boolean {
    return this.isEof() || this.peek().type === TokenType.Eol
  }

  private peek(): Token {
    return this.tokens[this.current]
  }

  private previous(): Token {
    return this.tokens[this.current - 1]
  }
}
