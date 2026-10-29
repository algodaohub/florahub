/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("storecfg0000001")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "scdefault0000001",
    "name": "is_default",
    "type": "bool",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {}
  }))

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("storecfg0000001")

  // remove
  collection.schema.removeField("scdefault0000001")

  return dao.saveCollection(collection)
})
