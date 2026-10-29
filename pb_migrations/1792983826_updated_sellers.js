/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("h4qhdwcx6tqkrs4")

  collection.indexes = [
    "CREATE UNIQUE INDEX `idx_sellers_slug` ON `sellers` (`slug`)"
  ]

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "csifmdsb",
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
  const collection = dao.findCollectionByNameOrId("h4qhdwcx6tqkrs4")

  collection.indexes = []

  // remove
  collection.schema.removeField("csifmdsb")

  return dao.saveCollection(collection)
})
