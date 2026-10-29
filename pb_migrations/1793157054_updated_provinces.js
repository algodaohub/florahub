/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("lj3o2sd6sdhhyff")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "skxzxfun",
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

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "gtsug63a",
    "name": "phone_code",
    "type": "number",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null,
      "noDecimal": true
    }
  }))

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("lj3o2sd6sdhhyff")

  // remove
  collection.schema.removeField("skxzxfun")

  // remove
  collection.schema.removeField("gtsug63a")

  return dao.saveCollection(collection)
})
