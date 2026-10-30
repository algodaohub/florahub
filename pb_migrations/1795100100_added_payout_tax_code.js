/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("affpayouts00001")

  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "afpytaxc",
    "name": "tax_code",
    "type": "text",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": { "min": null, "max": 20, "pattern": "" }
  }))

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("affpayouts00001")
  collection.schema.removeField("afpytaxc")
  return dao.saveCollection(collection)
})
