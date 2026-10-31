/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("assistdocs000001")

  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "adoc_train0001",
    "name": "for_training",
    "type": "bool",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {}
  }))

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("assistdocs000001")

  collection.schema.removeField("adoc_train0001")

  return dao.saveCollection(collection)
})
