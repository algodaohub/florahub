/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("1wnja9u9ccz1g2h")

  collection.indexes = [
    "CREATE UNIQUE INDEX `idx_promotions_code` ON `promotions` (`code`)"
  ]

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "emdiltbk",
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
  const collection = dao.findCollectionByNameOrId("1wnja9u9ccz1g2h")

  collection.indexes = []

  // remove
  collection.schema.removeField("emdiltbk")

  return dao.saveCollection(collection)
})
