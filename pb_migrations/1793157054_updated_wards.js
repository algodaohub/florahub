/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("8qjq0p4mp5c6kyc")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "yboaghrr",
    "name": "codename",
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
  const collection = dao.findCollectionByNameOrId("8qjq0p4mp5c6kyc")

  // remove
  collection.schema.removeField("yboaghrr")

  return dao.saveCollection(collection)
})
