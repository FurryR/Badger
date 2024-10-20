# Badger

Badger is a statically typed compiled high-level language based on Scratch.

It brings many aggressive features while keeping compatibility with Scratch itself.

You can create a library, compile it, and then use it in Scratch, or just create the entire program with Badger.

# Features

- Local variables (done by stack memory).
- Thread safety (mutex).
- Partial OOP (including generics).
- Dependency management (even in Scratch).
- Dynamic runtime JavaScript injection (boost your project for a lot).
- Interops (bitwise operations, case-sensitive comparisons, NaN/Infinity processing) implemented by IR. (from Linux on Scratch & Boiga)

# Project Status

The project is in early development. Only the parser is done, which won't perform type checks & generic inferences.

# How does dynamic runtime injections work?

```js
function getThread(vm) {
  const thread = vm.runtime._pushThread(
    '',
    {
      blocks: {
        getBlock() {
          return {}
        }
      }
    },
    { updateMonitor: true }
  )
  vm.runtime.sequencer.retireThread(thread)
  return thread.constructor
}
function patch(obj, key, fn) {
  if (obj[key]) obj[key] = fn(obj[key])
}
const vm = Scratch.vm // Whatever...
const Thread = getThread(vm)
patch(Thread.prototype, 'tryCompile', tryCompile => {
  return function () {
    tryCompile.call(this)
    for (const [k, v] of Object.entries(fnMap)) {
      patch(this.procedures, `W${k}`, fn => {
        if (fn instanceof function* () {}.constructor) {
          return function* (...args) {
            if (enabled) {
              try {
                const result = v(this.target, args)
                if (typeof result === 'boolean' && !result) return ''
                if (
                  typeof result === 'object' &&
                  result !== null &&
                  typeof result.then === 'function'
                ) {
                  this.status = 1 // STATUS_PROMISE_WAIT
                  let res = [0, undefined]
                  result.then(
                    v => {
                      res = [1, v]
                      this.status = 0 // STATUS_RUNNING
                    },
                    e => {
                      res = [2, e]
                      this.status = 0
                    }
                  )
                  yield
                  switch (res[0]) {
                    case 1:
                      if (!res[1]) return ''
                    case 2:
                      throw res[1]
                    default:
                      throw new Error('Unknown result')
                  }
                }
              } catch (e) {
                if (vm.runtime.emitCompileError)
                  vm.runtime.emitCompileError(this.target, e)
                console.error(e)
                return ''
              }
            } else {
              return yield* fn(...args)
            }
          }.bind(this)
        } else {
          return function (...args) {
            if (enabled) {
              try {
                const result = v(this.target, args)
                if (typeof result === 'boolean' && !result) return ''
                if (
                  typeof result === 'object' &&
                  result !== null &&
                  typeof result.then === 'function'
                ) {
                  throw new Error(
                    `'W${k}': Promise on non-generator; consider making the procedure async instead.`
                  )
                }
              } catch (e) {
                if (vm.runtime.emitCompileError)
                  vm.runtime.emitCompileError(this.target, e)
                console.error(e)
                return ''
              }
            } else {
              return fn(...args)
            }
          }.bind(this)
        }
      })
    }
  }
})

const Sequencer = vm.runtime.sequencer.constructor
patch(Sequencer.prototype, 'stepToProcedure', stepToProcedure => {
  return function (thread, procedureCode) {
    if (enabled && procedureCode in fnMap) {
      try {
        const result = fnMap[procedureCode](
          thread.target,
          thread.peekStackFrame().params
        )
        if (typeof result === 'boolean' && !result) return
        if (
          typeof result === 'object' &&
          result !== null &&
          typeof result.then === 'function'
        )
          return result.then(
            v => {
              if (!v) return
              else return stepToProcedure.call(this, thread, procedureCode)
            },
            e => {
              if (vm.runtime.emitCompileError)
                vm.runtime.emitCompileError(thread.target, e)
              console.error(e)
              return
            }
          )
      } catch (e) {
        if (vm.runtime.emitCompileError)
          vm.runtime.emitCompileError(thread.target, e)
        console.error(e)
        return
      }
    }
    return stepToProcedure.call(this, thread, procedureCode)
  }
})
```

This injection comes from GPU.js, one of my WIP projects.

# Hello World

```
import { sayForSeconds } from "sb3:looks";
import { whenFlagClicked } from "sb3:event";

@whenFlagClicked
async def hello() -> void {
  await sayForSeconds("Hello World!", 2);
}
```

You can see `./test.br` for a more advanced example of the language.

# TODOs

- IR
- Backend for Scratch
- Language documentation & specification
