/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("3eikh26fbr4q8k1")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "pf0000000000001",
    "name": "type",
    "type": "select",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "maxSelect": 1,
      "values": [
        "physical",
        "digital",
        "service"
      ]
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "pf0000000000002",
    "name": "requires_shipping",
    "type": "bool",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {}
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "pf0000000000003",
    "name": "weight_grams",
    "type": "number",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": 0,
      "max": 1000000,
      "noDecimal": false
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "pf0000000000004",
    "name": "seo_title",
    "type": "text",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": null,
      "max": 120,
      "pattern": ""
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "pf0000000000005",
    "name": "seo_description",
    "type": "text",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": null,
      "max": 320,
      "pattern": ""
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "pf0000000000006",
    "name": "seo_keywords",
    "type": "text",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": null,
      "max": 300,
      "pattern": ""
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "pf0000000000007",
    "name": "canonical_url",
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

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "pf0000000000008",
    "name": "aeo_summary",
    "type": "text",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": null,
      "max": 1200,
      "pattern": ""
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "pf0000000000009",
    "name": "highlights",
    "type": "json",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "maxSize": 10000
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "pf0000000000010",
    "name": "faq",
    "type": "json",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "maxSize": 20000
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "pf0000000000011",
    "name": "digital_file",
    "type": "file",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "mimeTypes": null,
      "thumbs": [],
      "maxSelect": 1,
      "maxSize": 52428800,
      "protected": true
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "pf0000000000012",
    "name": "digital_download_limit",
    "type": "number",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": 0,
      "max": 10000,
      "noDecimal": false
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "pf0000000000013",
    "name": "digital_expiry_days",
    "type": "number",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": 0,
      "max": 3650,
      "noDecimal": false
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "pf0000000000014",
    "name": "digital_license",
    "type": "text",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": null,
      "max": 5000,
      "pattern": ""
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "pf0000000000015",
    "name": "service_duration",
    "type": "number",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": 0,
      "max": 100000,
      "noDecimal": false
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "pf0000000000016",
    "name": "service_location",
    "type": "text",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": null,
      "max": 200,
      "pattern": ""
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "pf0000000000017",
    "name": "service_capacity",
    "type": "number",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": 0,
      "max": 100000,
      "noDecimal": false
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "pf0000000000018",
    "name": "service_booking_note",
    "type": "text",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": null,
      "max": 2000,
      "pattern": ""
    }
  }))

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("3eikh26fbr4q8k1")

  // remove
  collection.schema.removeField("pf0000000000001")

  // remove
  collection.schema.removeField("pf0000000000002")

  // remove
  collection.schema.removeField("pf0000000000003")

  // remove
  collection.schema.removeField("pf0000000000004")

  // remove
  collection.schema.removeField("pf0000000000005")

  // remove
  collection.schema.removeField("pf0000000000006")

  // remove
  collection.schema.removeField("pf0000000000007")

  // remove
  collection.schema.removeField("pf0000000000008")

  // remove
  collection.schema.removeField("pf0000000000009")

  // remove
  collection.schema.removeField("pf0000000000010")

  // remove
  collection.schema.removeField("pf0000000000011")

  // remove
  collection.schema.removeField("pf0000000000012")

  // remove
  collection.schema.removeField("pf0000000000013")

  // remove
  collection.schema.removeField("pf0000000000014")

  // remove
  collection.schema.removeField("pf0000000000015")

  // remove
  collection.schema.removeField("pf0000000000016")

  // remove
  collection.schema.removeField("pf0000000000017")

  // remove
  collection.schema.removeField("pf0000000000018")

  return dao.saveCollection(collection)
})
