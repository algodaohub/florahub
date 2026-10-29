/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("x9mxisxxd4fy3g2")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "kekhsiii",
    "name": "affiliate",
    "type": "relation",
    "required": true,
    "presentable": false,
    "unique": false,
    "options": {
      "collectionId": "hodszshy1vujjze",
      "cascadeDelete": true,
      "minSelect": null,
      "maxSelect": 1,
      "displayFields": [
        "code"
      ]
    }
  }))

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("x9mxisxxd4fy3g2")

  // remove
  collection.schema.removeField("kekhsiii")

  return dao.saveCollection(collection)
})
