/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("3eikh26fbr4q8k1")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "pf0000000000019",
    "name": "geo_service_areas",
    "type": "text",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": null,
      "max": 500,
      "pattern": ""
    }
  }))

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("3eikh26fbr4q8k1")

  // remove
  collection.schema.removeField("pf0000000000019")

  return dao.saveCollection(collection)
})
