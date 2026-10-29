/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("hodszshy1vujjze")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "bhshrkn1",
    "name": "user",
    "type": "relation",
    "required": true,
    "presentable": false,
    "unique": true,
    "options": {
      "collectionId": "_pb_users_auth_",
      "cascadeDelete": true,
      "minSelect": null,
      "maxSelect": 1,
      "displayFields": [
        "email"
      ]
    }
  }))

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("hodszshy1vujjze")

  // remove
  collection.schema.removeField("bhshrkn1")

  return dao.saveCollection(collection)
})
