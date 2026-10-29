/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("ca9q0d48jtsmn2q")

  collection.indexes = [
    "CREATE UNIQUE INDEX `idx_posts_slug` ON `posts` (`slug`)"
  ]

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "m17w8xq5",
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
  const collection = dao.findCollectionByNameOrId("ca9q0d48jtsmn2q")

  collection.indexes = []

  // remove
  collection.schema.removeField("m17w8xq5")

  return dao.saveCollection(collection)
})
