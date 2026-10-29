/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("mm516hwj0azlkvd")

  const addCode = (id, name, max) => collection.schema.addField(new SchemaField({
    "system": false,
    "id": id,
    "name": name,
    "type": "text",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": { "min": null, "max": max, "pattern": "" }
  }))

  addCode("shpacit1", "city_code", 20)
  addCode("shpadis1", "district_code", 20)
  addCode("shpawar1", "ward_code", 20)

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("mm516hwj0azlkvd")

  collection.schema.removeField("shpacit1")
  collection.schema.removeField("shpadis1")
  collection.schema.removeField("shpawar1")

  return dao.saveCollection(collection)
})
