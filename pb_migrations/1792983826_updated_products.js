/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("3eikh26fbr4q8k1")

  collection.indexes = [
    "CREATE UNIQUE INDEX `idx_products_handle` ON `products` (`handle`)"
  ]

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "vc67ghzc",
    "name": "legacy_id",
    "type": "text",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null,
      "pattern": ""
    }
  }))

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("3eikh26fbr4q8k1")

  collection.indexes = []

  // remove
  collection.schema.removeField("vc67ghzc")

  return dao.saveCollection(collection)
})
