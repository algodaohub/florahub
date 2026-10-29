/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("pga9hdjhxwqciu7")

  collection.indexes = [
    "CREATE UNIQUE INDEX `idx_categories_slug` ON `categories` (`slug`)"
  ]

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "7qmkgvvc",
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
  const collection = dao.findCollectionByNameOrId("pga9hdjhxwqciu7")

  collection.indexes = []

  // remove
  collection.schema.removeField("7qmkgvvc")

  return dao.saveCollection(collection)
})
