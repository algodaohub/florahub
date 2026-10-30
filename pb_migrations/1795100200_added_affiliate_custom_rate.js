/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("hodszshy1vujjze")

  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "afcstome",
    "name": "custom_rate",
    "type": "bool",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {}
  }))

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("hodszshy1vujjze")
  collection.schema.removeField("afcstome")
  return dao.saveCollection(collection)
})
