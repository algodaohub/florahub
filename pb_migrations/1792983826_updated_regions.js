/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("60szryjln2bav0o")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "yrfrb0ij",
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
  const collection = dao.findCollectionByNameOrId("60szryjln2bav0o")

  // remove
  collection.schema.removeField("yrfrb0ij")

  return dao.saveCollection(collection)
})
