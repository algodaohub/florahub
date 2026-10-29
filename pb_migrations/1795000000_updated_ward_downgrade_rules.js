/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("ward_downgrade_rules")
  const provinces = dao.findCollectionByNameOrId("provinces")
  const wards = dao.findCollectionByNameOrId("wards")

  // Relation thật tới danh mục 2 cấp; script `npm run pb:rules` backfill ID theo code.
  if (!collection.schema.getFieldByName("new_province")) {
    collection.schema.addField(new SchemaField({
      "system": false,
      "id": "wdrprov00000001",
      "name": "new_province",
      "type": "relation",
      "required": false,
      "presentable": false,
      "unique": false,
      "options": {
        "collectionId": provinces.id,
        "cascadeDelete": false,
        "minSelect": null,
        "maxSelect": 1,
        "displayFields": null
      }
    }))
  }

  if (!collection.schema.getFieldByName("new_ward")) {
    collection.schema.addField(new SchemaField({
      "system": false,
      "id": "wdrward00000001",
      "name": "new_ward",
      "type": "relation",
      "required": false,
      "presentable": false,
      "unique": false,
      "options": {
        "collectionId": wards.id,
        "cascadeDelete": false,
        "minSelect": null,
        "maxSelect": 1,
        "displayFields": null
      }
    }))
  }

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("ward_downgrade_rules")

  if (collection.schema.getFieldByName("new_province")) collection.schema.removeField("new_province")
  if (collection.schema.getFieldByName("new_ward")) collection.schema.removeField("new_ward")

  return dao.saveCollection(collection)
})
