// types/scalars.ts

import { scalarType } from 'nexus'
import { Kind, ValueNode } from 'graphql'  // ✅ import these

export const DateTimeScalar = scalarType({
    name: 'DateTime',
    asNexusMethod: 'dateTime',
    description: 'ISO 8601 DateTime string',
    parseValue(value: unknown) {
        if (typeof value === 'string' || typeof value === 'number') {
            return new Date(value)  // ✅ narrows the type before passing
        }
        throw new Error('DateTime must be a string or number')
    },
    serialize(value: unknown) {
        if (value instanceof Date) return value.toISOString()
        if (typeof value === 'string') return value
        throw new Error('DateTime serialize error: invalid value')
    },
    parseLiteral(ast: ValueNode) {  // ✅ use ValueNode instead of any
        if (ast.kind === Kind.STRING) {
            return new Date(ast.value)  // ✅ TypeScript now knows ast.value exists
        }
        throw new Error('DateTime must be a string literal')
    },
})

const parseJsonLiteral = (ast: ValueNode): unknown => {
  switch (ast.kind) {
    case Kind.STRING:
      return ast.value
    case Kind.BOOLEAN:
      return ast.value
    case Kind.INT:
    case Kind.FLOAT:
      return Number(ast.value)
    case Kind.OBJECT: {
      const obj: Record<string, unknown> = {}
      ast.fields.forEach((field) => {
        obj[field.name.value] = parseJsonLiteral(field.value)
      })
      return obj
    }
    case Kind.LIST:
      return ast.values.map(parseJsonLiteral)
    case Kind.NULL:
      return null
    default:
      return null
  }
}

export const JsonScalar = scalarType({
  name: 'Json',
  asNexusMethod: 'json',
  description: 'Arbitrary JSON value',
  parseValue(value: unknown) {
    return value
  },
  serialize(value: unknown) {
    return value
  },
  parseLiteral(ast: ValueNode) {
    return parseJsonLiteral(ast)
  },
})