/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("079aotcsll7btnx")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "iv7ttqhp",
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
  const collection = dao.findCollectionByNameOrId("079aotcsll7btnx")

  // remove
  collection.schema.removeField("iv7ttqhp")

  return dao.saveCollection(collection)
})
