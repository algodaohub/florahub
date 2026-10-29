/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("cbl3d7kuqrnrjw8")

  collection.indexes = [
    "CREATE UNIQUE INDEX `idx_variants_sku` ON `variants` (`sku`)"
  ]

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("cbl3d7kuqrnrjw8")

  collection.indexes = []

  return dao.saveCollection(collection)
})
