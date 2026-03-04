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