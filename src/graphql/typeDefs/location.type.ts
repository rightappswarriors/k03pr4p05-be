import { objectType } from 'nexus'

export const Location = objectType({
     name: 'Location',
     definition(t) {
          t.nonNull.int('id')
          t.nonNull.string('aisle')
          t.nonNull.string('rack')
          t.nonNull.string('shelf')
          t.nullable.field('item', {
               type:'InventoryItems',
               resolve: (parent, _, __) => {
                    return parent.item
               }
          })
     }
})